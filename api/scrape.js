// api/scrape.js

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
    // 1. Obtener la URL a scrapear del parámetro de consulta 'url'
    const targetUrl = req.query.url;

    // 2. Validar que la URL haya sido proporcionada
    if (!targetUrl) {
        // Si no hay URL, enviamos una respuesta de error 400 (Bad Request)
        return res.status(400).json({
            error: 'Falta el parámetro "url" en la consulta. Ejemplo: /api/scrape?url=https://www.ejemplo.com'
        });
    }

    let browser = null; // Inicializamos browser como null para el manejo de errores
    try {
        // 3. Configurar y lanzar Puppeteer con @sparticuz/chromium para Vercel
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            // Puedes añadir más argumentos si es necesario, por ejemplo para evitar problemas de sandbox
            // args: [...chromium.args, '--disable-gpu', '--disable-setuid-sandbox', '--no-sandbox'],
        });

        const page = await browser.newPage();

        // 4. Ir a la URL objetivo y esperar a que la red esté inactiva
        await page.goto(targetUrl, {
            waitUntil: 'networkidle2', // Espera hasta que no haya más de 2 conexiones de red por al menos 500ms
            timeout: 60000 // Aumenta el tiempo de espera por si la página tarda en cargar (60 segundos)
        });

        // 5. Extraer los datos de la página
        const data = await page.evaluate(() => {
            const modeloElement = document.querySelector('h1');
            const modelo = modeloElement ? modeloElement.innerText.trim() : 'Modelo no encontrado';

            const rows = Array.from(document.querySelectorAll('table.table tr')).slice(1); // Ignora el encabezado
            const cuotas = rows.map(row => {
                const tds = row.querySelectorAll('td');
                // Asegúrate de que los TDs existan antes de acceder a innerText
                const nro = tds[0] ? tds[0].innerText.trim() : '';
                const valor = tds[1] ? tds[1].innerText.trim() : '';
                const descripcion = tds[2] ? tds[2].innerText.trim() : '';

                return { nro, valor, descripcion };
            });

            return { modelo, cuotas };
        });

        // 6. Cerrar el navegador
        await browser.close();

        // 7. Enviar los datos como respuesta JSON
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // Cachear por 1 hora
        res.status(200).json(data);

    } catch (error) {
        console.error('Error durante el scraping:', error);

        // Asegurarse de cerrar el navegador si ocurrió un error
        if (browser) {
            await browser.close();
        }

        // 8. Enviar una respuesta de error 500 (Internal Server Error)
        res.status(500).json({
            error: 'Ocurrió un error interno durante el scraping.',
            details: error.message // Puedes añadir detalles del error para depuración
        });
    }
}