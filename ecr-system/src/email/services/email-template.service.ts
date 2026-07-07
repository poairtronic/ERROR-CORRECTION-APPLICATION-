import { Injectable } from '@nestjs/common';

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

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 20px auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background-color: #002d72; padding: 20px; text-align: center; color: white; }
          .header img { max-height: 50px; }
          .content { padding: 30px; }
          .footer { background-color: #eee; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="${appName} Logo" />
            <h2>${appName}</h2>
          </div>
          <div class="content">
            <h3 style="margin-top: 0;">${data.title}</h3>
            <p>${data.message.replace(/\n/g, '<br/>')}</p>
            ${this.renderTable(data.summaryTable)}
            ${this.renderButton(data.primaryButton)}
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply directly to this email.</p>
            <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
            <p>Generated at: ${timestamp}</p>
          </div>
        </div>
      </body>
      </html>
    `;
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
