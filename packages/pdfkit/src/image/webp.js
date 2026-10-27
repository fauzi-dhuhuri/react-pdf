import zlib from 'zlib';

class WEBPImage {
    constructor(image, label) {
        this.label = label;
        this.image = image;
        this.width = image.width;
        this.height = image.height;
        this.obj = null;
    }

    embed(document) {
        this.document = document;
        if (this.obj) {
            return;
        }

        this.obj = this.document.ref({
            Type: 'XObject',
            Subtype: 'Image',
            BitsPerComponent: 8,
            Width: this.width,
            Height: this.height,
            Filter: 'FlateDecode',
            ColorSpace: 'DeviceRGB',
        });

        return this.splitAlphaChannel();
    }

    splitAlphaChannel() {
        const pixelCount = this.width * this.height;
        const imgData = Buffer.alloc(pixelCount * 3);
        const alphaChannel = Buffer.alloc(pixelCount);

        const pixels = this.image.data;
        let rgbIdx = 0;
        let alphaIdx = 0;

        for (let i = 0; i < pixels.length; i += 4) {
            imgData[rgbIdx++] = pixels[i];
            imgData[rgbIdx++] = pixels[i + 1];
            imgData[rgbIdx++] = pixels[i + 2];
            alphaChannel[alphaIdx++] = pixels[i + 3];
        }

        this.imgData = zlib.deflateSync(imgData);
        this.alphaChannel = zlib.deflateSync(alphaChannel);

        return this.finalize();
    }

    finalize() {
        if (this.alphaChannel) {
            const sMask = this.document.ref({
                Type: 'XObject',
                Subtype: 'Image',
                Height: this.height,
                Width: this.width,
                BitsPerComponent: 8,
                Filter: 'FlateDecode',
                ColorSpace: 'DeviceGray',
                Decode: [0, 1],
            });

            sMask.end(this.alphaChannel);
            this.obj.data['SMask'] = sMask;
        }

        this.obj.end(this.imgData);

        this.image = null;
        this.imgData = null;
        this.alphaChannel = null;
    }
}

export default WEBPImage;