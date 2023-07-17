import puppeteer from 'puppeteer-extra';
import Stealth from 'puppeteer-extra-plugin-stealth';
import AdBlock from 'puppeteer-extra-plugin-adblocker';
import Anon from 'puppeteer-extra-plugin-anonymize-ua';
import { performAction, wait } from './action';
import { Browser, TimeoutError } from 'puppeteer';
import fs from 'fs/promises';
import axios from 'axios';
import { WebshareProxyProvider } from './webshare_proxy_provider';
import { EmptyProvider, blockIPForOthers } from './proxy_provider';

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


export let ipWorker = new EmptyProvider();


let workerCount = 2;
let browserCount = 1;
let currentlyOpenbrowsers = 0;
let useOwnIp = false;
let ownIp: string | undefined = undefined;
let fetchProxiesUrl = '';

process.on('unhandledRejection', async (error) => {
    console.log(error);
    await wait(3000);
    console.log('checking browser count...');
    console.log(`Currently ${currentlyOpenbrowsers} browsers open`);
    if (currentlyOpenbrowsers < browserCount) {
        console.log('Restarting browser...');
        startBrowser();
    }
});

async function main() {
    console.log('reading config...');
    await fs.readFile('./worker.config', 'utf-8').then((data) => {
        const lines = data.split('\n');
        for (const line of lines) {
            const fragments = line.split('=');
            if (fragments.length === 2) {
                const key = fragments[0].trim();
                const value = fragments[1].trim();
                if (key === 'browsers') {
                    browserCount = parseInt(value);
                } else if (key === 'workers') {
                    workerCount = parseInt(value);
                } else if (key === 'useOwnIp') {
                    useOwnIp = value === 'y';
                } else if (key === 'fetchProxiesUrl') {
                    fetchProxiesUrl = value;
                }
            }
        }
    }).catch((error) => {
        console.log(error);
    });

    if (fetchProxiesUrl.includes('https://')) {
        console.log(`using webshare proxy provider: ${fetchProxiesUrl}`);
        ipWorker = new WebshareProxyProvider(fetchProxiesUrl);
    }

    if (useOwnIp) {
        const res = await axios.get('http://ip-api.com/json/');
        ownIp = res.data.query;
        console.log(`also using own ip: ${ownIp}`);
    }

    const totalStartTime = Date.now();
    for (let i = 0; i < browserCount; i++) {
        startBrowser();
        await wait(15000);
    }
    while (true) {
        await wait(15000);
        printVotesPerMinute(stats, totalStartTime);
    }
}

async function startBrowser() {
    try {
        await executeBrowser();
    } catch (error) {
        currentlyOpenbrowsers--;
    }
    startBrowser();
}


async function executeBrowser(): Promise<void> {
    const browser = await buildBrowser();
    currentlyOpenbrowsers++;
    try {
        const times: number[] = [];
        while (true) {
            console.log('---------------------------------');
            const start = Date.now();
            await execute(browser);
            const end = Date.now();
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
    } catch (error) {
        console.log(error);
        await browser.close();
        await wait(8000);
        console.log('Restarting browser');
    }
}

function printVotesPerMinute(stats: Stats, start: number) {
    const { totalVotes } = stats;
    const end = Date.now();
    const votesPerMin = totalVotes / ((end - start) / 1000 / 60);
    const roundWithOneDecimal = Math.round(votesPerMin * 10) / 10;
    console.log(`Current votes per minute: ${roundWithOneDecimal}`);
}


export async function buildBrowser(): Promise<Browser> {
    const options = { width: 1920 * 0.8, height: 1080 * 0.8 };
    const browser = await puppeteer.launch({
        headless: headless ? 'new' : false,
        userDataDir: './puppeteer_data',
        args: [
            `--window-size=${options.width},${options.height}`,
            '--no-sandbox',
        ],
    });
    return browser;
}

async function execute(browser: Browser): Promise<void> {
    const concurrentWorkes = workerCount;
    const promises: Promise<void>[] = [];
    for (let i = 0; i < concurrentWorkes; i++) {
        promises.push(startPage(browser));
    }
    await Promise.all(promises);
}

async function startPage(browser: Browser): Promise<void> {
    const page = await browser.newPage();
    try {
        const proxy = await ipWorker.getUnusedProxy(58000, ownIp);
        console.log(proxy);
        await proxy.applyProxy(page);
        // if performAction takes longer than 3 minutes, abort
        try {
            await performAction(page, false, proxy.endpointIp, stats);
        } catch (error:any) {
            console.log('❌  Aborting action');
            console.log(error);
            // if error is timeout
            if (error instanceof TimeoutError) {
               blockIPForOthers(proxy.endpointIp);
            }
        }
        try {
            await page.close();
        } catch (error) {
        }
    } catch (error) {
        console.log(error);
    }
}


main().catch(console.error);
