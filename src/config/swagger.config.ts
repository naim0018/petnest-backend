import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerCustomOptions, SwaggerModule } from '@nestjs/swagger';

const customCss = `
  /* Hide default Swagger top bar */
  .swagger-ui .topbar { display: none; }

  /* Modern Background & Font */
  body {
    background-color: #0b0f19 !important;
    color: #f1f5f9 !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif !important;
  }

  .swagger-ui {
    color: #e2e8f0 !important;
  }

  /* Filter / Search Bar */
  .swagger-ui .wrapper .filter-container {
    margin: 24px 0 16px 0 !important;
    padding: 0 !important;
  }
  .swagger-ui .filter-container .operation-filter-input {
    background: #1e293b !important;
    color: #f8fafc !important;
    border: 1px solid #334155 !important;
    border-radius: 8px !important;
    padding: 12px 16px !important;
    font-size: 15px !important;
    width: 100% !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .swagger-ui .filter-container .operation-filter-input:focus {
    border-color: #3b82f6 !important;
    outline: none !important;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25) !important;
  }

  /* Headers & Typography */
  .swagger-ui .info .title {
    color: #f8fafc !important;
    font-size: 32px !important;
    font-weight: 700 !important;
  }
  .swagger-ui .info p,
  .swagger-ui .info li,
  .swagger-ui .opblock-tag,
  .swagger-ui .opblock-tag small,
  .swagger-ui table thead tr th,
  .swagger-ui .opblock-description-wrapper p {
    color: #cbd5e1 !important;
  }

  /* Operation Blocks */
  .swagger-ui .opblock {
    background: #111827 !important;
    border-radius: 10px !important;
    border: 1px solid #1f2937 !important;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2) !important;
    margin-bottom: 12px !important;
  }
  .swagger-ui .opblock .opblock-summary {
    border-radius: 10px !important;
  }
  .swagger-ui .opblock .opblock-summary-path,
  .swagger-ui .opblock .opblock-summary-description {
    color: #f3f4f6 !important;
  }

  /* Authorize Button */
  .swagger-ui .btn.authorize {
    border-color: #10b981 !important;
    color: #10b981 !important;
    border-radius: 8px !important;
  }
  .swagger-ui .btn.authorize svg {
    fill: #10b981 !important;
  }

  /* Execute & Interactive Buttons */
  .swagger-ui .btn.execute {
    background-color: #2563eb !important;
    border-color: #2563eb !important;
    color: #ffffff !important;
    border-radius: 6px !important;
  }
  .swagger-ui .btn.try-out__btn {
    border-radius: 6px !important;
    color: #94a3b8 !important;
    border-color: #475569 !important;
  }

  /* Generate Random Payload Button */
  .custom-random-btn {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
    color: white !important;
    border: none !important;
    border-radius: 6px !important;
    padding: 6px 12px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    margin-left: 12px !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
    transition: transform 0.15s ease, filter 0.15s ease !important;
  }
  .custom-random-btn:hover {
    transform: translateY(-1px) !important;
    filter: brightness(1.1) !important;
  }
  .custom-random-btn:active {
    transform: translateY(0) !important;
  }

  /* Models & Schemas Section */
  .swagger-ui section.models {
    border: 1px solid #1f2937 !important;
    border-radius: 10px !important;
    background: #111827 !important;
  }
  .swagger-ui section.models h4 {
    color: #e2e8f0 !important;
  }
  .swagger-ui .model-box {
    background: #0f172a !important;
  }
`;

const customJsStr = `
  window.addEventListener('load', () => {
    function randomizeValue(key, val) {
      const rand = Math.floor(Math.random() * 9000 + 1000);
      const k = key.toLowerCase();
      if (k.includes('email')) {
        const prefix = typeof val === 'string' && val.includes('@') ? val.split('@')[0] : 'user';
        return prefix.replace(/\\d+$/, '') + rand + '@example.com';
      }
      if (k.includes('name')) {
        const base = typeof val === 'string' ? val.replace(/\\s*\\d+$/, '') : 'User';
        return base + ' ' + rand;
      }
      if (k.includes('phone')) {
        return '+1415' + Math.floor(Math.random() * 9000000 + 1000000);
      }
      if (k.includes('uuid') || (k.includes('id') && typeof val === 'string' && val.includes('-'))) {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
      }
      return val;
    }

    function mutateJson(obj) {
      if (Array.isArray(obj)) {
        return obj.map(mutateJson);
      } else if (obj !== null && typeof obj === 'object') {
        const res = {};
        for (const k of Object.keys(obj)) {
          res[k] = mutateJson(obj[k]);
          res[k] = randomizeValue(k, res[k]);
        }
        return res;
      }
      return obj;
    }

    function setNativeValue(element, value) {
      const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')
        ? Object.getOwnPropertyDescriptor(element, 'value').set
        : null;
      const prototype = Object.getPrototypeOf(element);
      const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')
        ? Object.getOwnPropertyDescriptor(prototype, 'value').set
        : null;

      if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter.call(element, value);
      } else if (valueSetter) {
        valueSetter.call(element, value);
      } else {
        element.value = value;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function attachRandomButtons() {
      const bodySections = document.querySelectorAll('.body-param, .opblock-body');
      bodySections.forEach((section) => {
        const textarea = section.querySelector('textarea.body-param__text');
        if (!textarea) return;

        const targetHeader =
          section.querySelector('.body-param-options') ||
          section.querySelector('label') ||
          textarea.parentElement;
        if (!targetHeader || targetHeader.querySelector('.custom-random-btn')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'custom-random-btn';
        btn.innerText = '🎲 Randomize Payload';
        btn.title = 'Generates new random unique email, phone, name, and ID';

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          try {
            const currentText = textarea.value || '';
            const json = JSON.parse(currentText);
            const randomized = mutateJson(json);
            const formatted = JSON.stringify(randomized, null, 2);
            setNativeValue(textarea, formatted);
          } catch (err) {
            console.warn('Could not parse JSON to randomize:', err);
          }
        });

        targetHeader.appendChild(btn);
      });
    }

    setInterval(attachRandomButtons, 800);
  });
`;

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('PetNest API')
    .setDescription('API Documentation for PetNest')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('user')
    .addTag('pet')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const customOptions: SwaggerCustomOptions = {
    customSiteTitle: 'PetNest API Docs',
    swaggerOptions: {
      filter: true,
      persistAuthorization: true,
      docExpansion: 'list',
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
    customCss,
    customJsStr,
  };

  SwaggerModule.setup('api', app, document, customOptions);
}
