import decode, { init as initWebpDecode } from "@jsquash/webp/decode";

import { RasterImage } from "./types";

let isWasmInitialised = false;

function BufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
    return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
}

function isWebp(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 12) {
        return false;
    }

    const isRiff = buffer.toString('ascii', 0, 4) === 'RIFF';
    const isWebp = buffer.toString('ascii', 8, 12) === 'WEBP';

    return isRiff && isWebp;
}

async function decodeWebp(data: ArrayBuffer) {
    const image = await decode(data);
    return image;
}

async function ensureWASMloaded() {
    if (isWasmInitialised) return;

    try {
        if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
            const fs = eval('require("fs")');
            const path = eval('require("path")');

            const wasmPath = path.resolve(
                eval('require.resolve("@jsquash/webp/package.json")'),
                '../codec/dec/webp_dec.wasm'
            );
            const wasmBuffer = fs.readFileSync(wasmPath);
            const wasmArrayBuffer = wasmBuffer.buffer.slice(
                wasmBuffer.byteOffset,
                wasmBuffer.byteOffset + wasmBuffer.byteLength
            ) as ArrayBuffer;
            await initWebpDecode({
                wasmBinary: wasmArrayBuffer
            });
        } else {
            try {
                const response = await fetch('https://unpkg.com/@jsquash/webp@1.5.0/codec/dec/webp_dec.wasm');
                if (!response.ok) throw new Error('CDN response was not ok');
                const wasmArrayBuffer = await response.arrayBuffer();
                await initWebpDecode({
                    wasmBinary: wasmArrayBuffer
                });
            } catch (err) {
                console.warn('Failed to load WASM from CDN, trying default fallback...', err);
                await initWebpDecode();
            }
        }
        isWasmInitialised = true;
    } catch (error) {
        throw new Error("Failed to load jSquash WebAssembly binary", {
            cause: error,
        });
    }
}

class WEBP implements RasterImage {
    data: Buffer;
    width: number;
    height: number;
    format: "webp";

    constructor(data: Buffer, width: number, height: number, format: "webp") {
        this.data = data;
        this.width = width;
        this.height = height;
        this.format = format;
    }

    static async create(data: Buffer): Promise<WEBP> {
        await ensureWASMloaded();

        const image = await decodeWebp(BufferToArrayBuffer(data));

        const decodedPixelsBuffer = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength);

        return new WEBP(decodedPixelsBuffer, image.width, image.height, "webp");
    }

    static isValid(data: Buffer): boolean {
        return isWebp(data);
    }
}

export default WEBP;