import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
    const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto('https://www.planrombo.com.ar/plan/kwid-iconic-bitono-cuota-fija-1-12-120-cuotas-100-financiado?data=1', {
        waitUntil: 'networkidle2',
    });

    const data = await page.evaluate(() => {
        const modelo = document.querySelector('h1')?.innerText || 'No encontrado';
        const rows = Array.from(document.querySelectorAll('table.table tr')).slice(1);
        const cuotas = rows.map(row => {
            const tds = row.querySelectorAll('td');
            return {
                nro: tds[0]?.innerText.trim(),
                valor: tds[1]?.innerText.trim(),
                descripcion: tds[2]?.innerText.trim()
            };
        });

        return { modelo, cuotas };
    });

    await browser.close();
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.status(200).json(data);
}
