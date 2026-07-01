export declare class ImageUploadService {
    constructor();
    uploadImage(file: Express.Multer.File): Promise<string>;
    uploadMultipleImages(files: Express.Multer.File[]): Promise<string[]>;
    deleteImage(imageUrl: string): Promise<void>;
    private validateFile;
}
