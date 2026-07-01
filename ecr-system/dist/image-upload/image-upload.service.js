"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageUploadService = void 0;
const common_1 = require("@nestjs/common");
const cloudinary_1 = require("cloudinary");
const streamifier = require("streamifier");
let ImageUploadService = class ImageUploadService {
    constructor() {
    }
    async uploadImage(file) {
        this.validateFile(file);
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                folder: 'ecr-system',
                resource_type: 'image',
                quality: 'auto:good',
            }, (error, result) => {
                if (error)
                    return reject(error);
                resolve(result.secure_url);
            });
            streamifier.createReadStream(file.buffer).pipe(uploadStream);
        });
    }
    async uploadMultipleImages(files) {
        if (!files || files.length === 0)
            return [];
        const uploadPromises = files.map((file) => this.uploadImage(file));
        return Promise.all(uploadPromises);
    }
    async deleteImage(imageUrl) {
        try {
            const parts = imageUrl.split('/');
            const filename = parts.pop();
            const folder = parts.pop();
            if (!filename || !folder)
                return;
            const publicId = `${folder}/${filename.split('.')[0]}`;
            await cloudinary_1.v2.uploader.destroy(publicId);
        }
        catch (e) {
            console.error('Failed to delete image from Cloudinary', e);
        }
    }
    validateFile(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024;
        if (!allowedTypes.includes(file.mimetype)) {
            throw new common_1.BadRequestException(`Invalid file type: ${file.mimetype}. Allowed: jpg, jpeg, png, webp`);
        }
        if (file.size > maxSize) {
            throw new common_1.BadRequestException(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max size is 5MB.`);
        }
    }
};
exports.ImageUploadService = ImageUploadService;
exports.ImageUploadService = ImageUploadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ImageUploadService);
//# sourceMappingURL=image-upload.service.js.map