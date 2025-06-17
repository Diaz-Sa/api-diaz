// api/scrape.js

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({
            error: 'Falta el parámetro "url" en la consulta. Ejemplo: /api/scrape?url=https://www.ejemplo.com'
        });
    }

    let browser = null;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'], // <--- ¡AÑADE ESTOS ARGUMENTOS!
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            // Si chromium.headless es 'new', puedes intentar 'chrome-new' o 'true' para compatibilidad
            // headless: chromium.headless || 'new', // Esto es si headless es undefined
        });

        const page = await browser.newPage();
        await page.goto(targetUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        const data = await page.evaluate(() => {
            const modeloElement = document.querySelector('h1');
            const modelo = modeloElement ? modeloElement.innerText.trim() : 'Modelo no encontrado';

            const rows = Array.from(document.querySelectorAll('table.table tr')).slice(1);
            const cuotas = rows.map(row => {
                const tds = row.querySelectorAll('td');
                const nro = tds[0] ? tds[0].innerText.trim() : '';
                const valor = tds[1] ? tds[1].innerText.trim() : '';
                const descripcion = tds[2] ? tds[2].innerText.trim() : '';
                return { nro, valor, descripcion };
            });
            return { modelo, cuotas };
        });

        await browser.close();
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.status(200).json(data);

    } catch (error) {
        console.error('Error durante el scraping:', error);
        if (browser) {
            await browser.close();
        }
        res.status(500).json({
            error: 'Ocurrió un error interno durante el scraping.',
            details: error.message
        });
    }
}