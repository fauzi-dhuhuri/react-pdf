import { describe, it, expect, vi } from 'vitest'; // Ganti ke 'jest' jika monorepo menggunakan Jest
import zlib from 'zlib';
import PDFImage from '../../src/image';
import WEBPImage from '../../src/image/webp';

describe('PDFKit WEBP Image Integration Test', () => {
    // 1. Mock Document Object milik PDFKit
    const mockDocument = {
        ref: vi.fn().mockImplementation((data) => {
            return {
                data: data || {},
                end: vi.fn().mockImplementation(function (this: any, bytes: any) {
                    this.finalBytes = bytes; // Simpan biner akhir untuk dicek
                })
            };
        })
    };

    it('harus bisa menerima objek WebP dan memisahkan RGBA dengan benar', () => {
        // 2. Buat data dummy RGBA murni (2x2 piksel = 4 piksel = 16 byte)
        // Format: R, G, B, A, R, G, B, A ...
        const dummyRgbaBuffer = Buffer.from([
            255, 0, 0, 255,       // Piksel 1: Merah penuh, Opaque
            0, 255, 0, 255,       // Piksel 2: Hijau penuh, Opaque
            0, 0, 255, 128,       // Piksel 3: Biru penuh, Transparansi Setengah
            255, 255, 255, 0      // Piksel 4: Putih penuh, Transparan Total
        ]);

        const mockSrc = {
            data: dummyRgbaBuffer,
            width: 2,
            height: 2,
            format: 'webp'
        };

        // 3. Eksekusi Gerbang Utama PDFImage.open
        const imageInstance = PDFImage.open(mockSrc, 'I1') as WEBPImage;

        console.log('=== ISI METADATA DI DALAM UNIT TEST ===');
        console.log('Apakah Label Terisi?:', imageInstance.label);
        console.log('Berapa Width-nya?:', imageInstance.width);
        console.log('=======================================');

        // Beri tahu TypeScript bahwa kita yakin imageInstance tidak mungkin undefined (Non-null Assertion)
        if (!imageInstance) {
            throw new Error('imageInstance is undefined!');
        }

        // Memastikan PDFImage mengarahkan ke Class WEBPImage kustom kita
        expect(imageInstance).toBeInstanceOf(WEBPImage);
        expect(imageInstance.width).toBe(2);
        expect(imageInstance.height).toBe(2);

        // 4. Jalankan Proses Embed ke Dokumen Mock
        imageInstance.embed(mockDocument);

        // 5. VALIDASI UTAMA: Memeriksa Kebocoran Biner
        const finalImgData = (imageInstance as any).obj.finalBytes;
        const finalAlphaChannel = (imageInstance as any).obj.data['SMask'].finalBytes;

        expect(finalImgData).toBeDefined();
        expect(finalAlphaChannel).toBeDefined();

        // Lakukan Decompress (Inflate) untuk memastikan datanya tidak rusak/kosong
        const decompressedRgb = zlib.inflateSync(finalImgData);
        const decompressedAlpha = zlib.inflateSync(finalAlphaChannel);

        // Panjang RGB harusnya 2 piksel * 2 piksel * 3 channel = 12 byte
        expect(decompressedRgb.length).toBe(12);
        // Panjang Alpha harusnya 2 piksel * 2 piksel * 1 channel = 4 byte
        expect(decompressedAlpha.length).toBe(4);

        // Cek apakah isi byte warnanya sesuai setelah dipisah (R,G,B pertama harus 255, 0, 0)
        expect(decompressedRgb[0]).toBe(255); // R
        expect(decompressedRgb[1]).toBe(0);   // G
        expect(decompressedRgb[2]).toBe(0);   // B

        // Cek channel Alpha ketiga (harus 128)
        expect(decompressedAlpha[2]).toBe(128);

        console.log('✅ TEST BERHASIL: Pipeline pemisahan biner beralur lancar!');
    });
});