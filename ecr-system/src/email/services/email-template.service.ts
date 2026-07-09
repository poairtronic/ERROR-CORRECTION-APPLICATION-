import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export interface TemplateData {
  employeeName?: string;
  role?: string;
  reportId?: string;
  component?: string;
  errorType?: string;
  priority?: string;
  createdDate?: string;
  status?: string;
  comments?: string;
  reviewer?: string;
  applicationUrl?: string;
  
  // existing support
  title?: string;
  message?: string;
  summaryTable?: Record<string, string>;
  primaryButton?: {
    text: string;
    url: string;
  };
}

@Injectable()
export class EmailTemplateService {
  private templates: Map<string, Handlebars.TemplateDelegate> = new Map();
  private isPartialsRegistered = false;

  constructor(private configService: ConfigService) {}

  private getTemplatePath(filename: string): string {
    const pathsToTry = [
      path.join(__dirname, '..', 'templates', filename),
      path.join(__dirname, 'templates', filename),
      path.join(process.cwd(), 'src', 'email', 'templates', filename),
      path.join(process.cwd(), 'dist', 'email', 'templates', filename),
    ];

    for (const p of pathsToTry) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    throw new Error(`Email template file [${filename}] not found`);
  }

  private registerPartials() {
    if (this.isPartialsRegistered) return;
    
    try {
      const headerPath = this.getTemplatePath('header.html');
      const footerPath = this.getTemplatePath('footer.html');
      
      const headerSource = fs.readFileSync(headerPath, 'utf8');
      const footerSource = fs.readFileSync(footerPath, 'utf8');
      
      Handlebars.registerPartial('header', headerSource);
      Handlebars.registerPartial('footer', footerSource);
      
      this.isPartialsRegistered = true;
    } catch (error) {
      console.error('Failed to register Handlebars partials:', error);
    }
  }

  private getLayoutTemplate(): Handlebars.TemplateDelegate {
    if (this.templates.has('layout')) {
      return this.templates.get('layout')!;
    }
    const layoutPath = this.getTemplatePath('layout.html');
    const layoutSource = fs.readFileSync(layoutPath, 'utf8');
    const compiled = Handlebars.compile(layoutSource);
    this.templates.set('layout', compiled);
    return compiled;
  }

  private getCompiledTemplate(templateName: string): Handlebars.TemplateDelegate {
    this.registerPartials();

    const cacheKey = templateName;
    if (this.templates.has(cacheKey)) {
      return this.templates.get(cacheKey)!;
    }

    try {
      const templatePath = this.getTemplatePath(`${templateName}.html`);
      const source = fs.readFileSync(templatePath, 'utf8');
      const compiled = Handlebars.compile(source);
      this.templates.set(cacheKey, compiled);
      return compiled;
    } catch (error) {
      console.warn(`Template [${templateName}] not found, using default fallback engine`);
      // Fallback compilation to keep system resilient (Validation: Show placeholder text)
      const compiled = Handlebars.compile(
        `<h3>{{title}}</h3><p>{{message}}</p>`
      );
      this.templates.set(cacheKey, compiled);
      return compiled;
    }
  }

  renderHtml(templateName: string, data: TemplateData, subject = '[ECR] Update'): string {
    const layoutTemplate = this.getLayoutTemplate();
    const bodyTemplate = this.getCompiledTemplate(templateName);

    // Merge env variables with fallback support
    const context = {
      appName: this.configService.get<string>('EMAIL_FROM_NAME', 'Velan Metrology'),
      logoUrl: 'https://via.placeholder.com/150x50?text=Logo',
      supportEmail: 'posuppportairtronic@gmail.com',
      currentYear: new Date().getFullYear().toString(),
      timestamp: new Date().toISOString(),
      subject,
      
      // Escape values safely
      employeeName: data.employeeName || 'Employee',
      role: data.role || 'N/A',
      reportId: data.reportId || 'N/A',
      component: data.component || 'N/A',
      errorType: data.errorType || 'N/A',
      priority: data.priority || 'N/A',
      createdDate: data.createdDate || 'N/A',
      status: data.status || 'N/A',
      comments: data.comments || '',
      reviewer: data.reviewer || 'N/A',
      applicationUrl: data.applicationUrl || 'http://localhost:5173',
      
      // Backward compatibility support for old calls
      title: data.title || '',
      message: data.message || '',
    };

    const bodyHtml = bodyTemplate(context);
    const finalHtml = layoutTemplate({
      ...context,
      body: bodyHtml,
    });

    return finalHtml;
  }

  renderText(data: TemplateData): string {
    let text = `${data.title || 'Notification'}\n\n`;
    text += `${data.message || ''}\n\n`;

    if (data.reportId) {
      text += `Report Number: ${data.reportId}\n`;
      text += `Status: ${data.status || 'N/A'}\n`;
      text += `Reviewer: ${data.reviewer || 'N/A'}\n`;
    }

    text += `Generated at: ${new Date().toISOString()}\n`;
    return text;
  }
}
