import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface TemplateData {
  title: string;
  message: string;
  primaryButton?: {
    text: string;
    url: string;
  };
  summaryTable?: Record<string, string>;
  logoUrl?: string;
  appName?: string;
}

@Injectable()
export class EmailTemplateService {
  private getTemplateHtml(): string {
    const pathsToTry = [
      path.join(__dirname, '..', 'templates', 'default-template.html'),
      path.join(__dirname, 'templates', 'default-template.html'),
      path.join(process.cwd(), 'src', 'email', 'templates', 'default-template.html'),
      path.join(process.cwd(), 'dist', 'email', 'templates', 'default-template.html'),
    ];

    for (const p of pathsToTry) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8');
      }
    }
    // Fallback if file is somehow missing
    return `
      <!DOCTYPE html>
      <html>
      <body>
        <h3>{{title}}</h3>
        <p>{{message}}</p>
        {{table}}
        {{button}}
      </body>
      </html>
    `;
  }

  private renderTable(tableData: Record<string, string> | undefined): string {
    if (!tableData || Object.keys(tableData).length === 0) return '';
    const rows = Object.entries(tableData)
      .map(
        ([key, value]) =>
          `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${key}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${value}</td>
          </tr>`
      )
      .join('');
    return `<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tbody>${rows}</tbody>
    </table>`;
  }

  private renderButton(button: TemplateData['primaryButton']): string {
    if (!button) return '';
    return `
      <div style="margin: 30px 0; text-align: center;">
        <a href="${button.url}" style="background-color: #0056b3; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
          ${button.text}
        </a>
      </div>
    `;
  }

  renderHtml(data: TemplateData): string {
    const logoUrl = data.logoUrl || 'https://via.placeholder.com/150x50?text=Logo';
    const appName = data.appName || 'Enterprise Notification System';
    const timestamp = new Date().toISOString();
    const year = new Date().getFullYear().toString();
    const table = this.renderTable(data.summaryTable);
    const button = this.renderButton(data.primaryButton);
    const formattedMessage = data.message.replace(/\n/g, '<br/>');

    let template = this.getTemplateHtml();
    template = template.replace(/\{\{logoUrl\}\}/g, logoUrl);
    template = template.replace(/\{\{appName\}\}/g, appName);
    template = template.replace(/\{\{title\}\}/g, data.title);
    template = template.replace(/\{\{message\}\}/g, formattedMessage);
    template = template.replace(/\{\{table\}\}/g, table);
    template = template.replace(/\{\{button\}\}/g, button);
    template = template.replace(/\{\{year\}\}/g, year);
    template = template.replace(/\{\{timestamp\}\}/g, timestamp);

    return template;
  }

  renderText(data: TemplateData): string {
    let text = `${data.title}\n\n`;
    text += `${data.message}\n\n`;

    if (data.summaryTable) {
      Object.entries(data.summaryTable).forEach(([key, value]) => {
        text += `${key}: ${value}\n`;
      });
      text += `\n`;
    }

    if (data.primaryButton) {
      text += `Action Link: ${data.primaryButton.url}\n\n`;
    }

    text += `Generated at: ${new Date().toISOString()}\n`;
    return text;
  }
}
