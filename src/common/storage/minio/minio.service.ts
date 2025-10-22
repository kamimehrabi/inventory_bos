// src/common/storage/minio-client.service.ts

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { WinstonLogger } from 'src/common/logger/winston-logger/winston-logger.service'; // <-- Import your logger

@Injectable()
export class MinioService {
  private minioClient: Minio.Client;
  private readonly bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: WinstonLogger,
  ) {
    this.logger.setContext(MinioService.name);

    this.bucketName =
      this.configService.get<string>('MINIO_BUCKET_NAME') || 'vehicle-images';

    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_HOST') || 'localhost',
      port: this.configService.get<number>('MINIO_PORT') || 9000,
      useSSL: false,
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY'),
    });

    this.createBucketIfNotExist();
  }

  private async createBucketIfNotExist() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(
          `MinIO Bucket '${this.bucketName}' created successfully.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error checking/creating MinIO bucket: ${error.message}`,
        error.stack,
      );
    }
  }

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    const fileExtension = file.originalname.split('.').pop();
    const objectName = `${folder}${Date.now()}-${file.fieldname}.${fileExtension}`;

    try {
      this.logger.debug(`Starting upload of file: ${objectName}`);

      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        file.buffer,
        file.size,
        { 'Content-Type': file.mimetype },
      );

      this.logger.log(`Successfully uploaded object: ${objectName}`);

      return `/${this.bucketName}/${objectName}`;
    } catch (error) {
      this.logger.error(
        `Failed to upload file to MinIO: ${error.message}`,
        error.stack,
      ); // <-- Use logger.error
      throw new InternalServerErrorException('Failed to upload file.');
    }
  }
}
