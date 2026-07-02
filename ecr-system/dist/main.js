"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
const cookieParser = require("cookie-parser");
const helmet_1 = require("helmet");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const config = app.get(config_1.ConfigService);
    app.use(cookieParser());
    app.use((0, helmet_1.default)());
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    const frontendUrl = config.get('FRONTEND_URL') ?? 'http://localhost:5173';
    app.enableCors({
        origin: frontendUrl,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
    }));
    app.setGlobalPrefix('api');
    const port = config.get('PORT') ?? 3000;
    await app.listen(port);
    console.log(`ECR System API running on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map