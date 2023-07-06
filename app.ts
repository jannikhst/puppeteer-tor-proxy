import puppeteer from 'puppeteer-extra';
import Stealth from 'puppeteer-extra-plugin-stealth';
import AdBlock from 'puppeteer-extra-plugin-adblocker';
import Anon from 'puppeteer-extra-plugin-anonymize-ua';
import useProxy from 'puppeteer-page-proxy';
import { performAction, wait } from './action';
import { Browser, Page } from 'puppeteer';
import { IpWorker } from './ip_worker';

puppeteer.use(Anon());
puppeteer.use(Stealth());
puppeteer.use(AdBlock());

export interface Stats {
    totalVotes: number;
    totalAttempts: number;
}

const stats: Stats = {
    totalVotes: 0,
    totalAttempts: 0,
};
const headless: boolean = process.env.RUN_HEADLESS === 'true';
const ipWorker = new IpWorker();

async function main() {
    startBrowser();
    await wait(15000);
    startBrowser();
    await wait(15000);
    startBrowser();
    await wait(15000);
    startBrowser();
}

async function startBrowser() {
    const totalStartTime = Date.now();
    const browser = await buildBrowser();
    const times: number[] = [];
    while (true) {
        console.log('---------------------------------');
        const start = Date.now();
        await execute(browser);
        const end = Date.now();
        printVotesPerminute(stats, totalStartTime);
        times.push(end - start);
        console.log(`Took ${end - start}ms for iteration`);
        if (times.length > 30) {
            times.shift();
        }
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`Average: ${Math.round(avg / 1000)}s`);
        const totalVotes = stats.totalVotes;
        const totalAttempts = stats.totalAttempts;
        const quota = totalVotes / totalAttempts;
        // in percent
        console.log(`total votes: ${totalVotes}`);
        console.log(`total attempts: ${totalAttempts}`);
        console.log(`success rate: ${Math.round(quota * 100)}%`);
        console.log('---------------------------------\n\n');
    }
}

function printVotesPerminute(stats: Stats, start: number) {
    const { totalVotes } = stats;
    const end = Date.now();
    const votesPerMin = totalVotes / ((end - start) / 1000 / 60);
    console.log(`Current votes per minute: ${Math.round(votesPerMin)}`);
}


async function buildBrowser(): Promise<Browser> {
    const options = { width: 1920, height: 1080 };
    const browser = await puppeteer.launch({
        headless: headless ? 'new' : false,
        args: [
            `--window-size=${options.width},${options.height}`,
            '--no-sandbox',
        ],
    });
    return browser;
}

async function execute(browser: Browser): Promise<void> {
    const concurrentWorkes = 3;
    const promises: Promise<void>[] = [];
    for (let i = 0; i < concurrentWorkes; i++) {
        promises.push(startPage(browser, concurrentWorkes * 21000));
    }
    await Promise.all(promises);
}

main().catch(console.error);


async function startPage(browser: Browser, timeoutMs: number): Promise<void> {
    const page = await browser.newPage();
    try {
        const tor = await ipWorker.getUnusedInstance(62000);
        await useProxy(page, tor.proxyUrl);
        // if performAction takes longer than 3 minutes, abort
        let timeouted = false;
        const timeout = setTimeout(async () => {
            timeouted = true;
            console.log('❌  Timeout');
            try {
                await page.close();
            } catch (error) {
            }
        }, timeoutMs);

        try {
            await performAction(page, false, tor.info.ip, stats);
        } catch (error) {
            console.log('❌  Aborting action');
        }
        if (!timeouted) {
            clearTimeout(timeout);
        }
        try {
            await page.close();
        } catch (error) {
        }
    } catch (error) {
        console.log(error);
    }
}


