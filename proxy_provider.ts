import { Page } from "puppeteer";
import axios from "axios";

export abstract class ProxyProvider {
    abstract createProxy(): Promise<Proxy>;

    async prepare(count: number): Promise<void> {
        console.log(`🟢  Preparing ${count} connections...`);
        const tasks: Promise<any>[] = [];
        for (let i = 0; i < count; i++) {
            tasks.push(this.createProxy());
        }
        await Promise.all(tasks);
        console.log(`🟢  Prepared ${count} connections.`);
    }

    abstract closeProxy(endpoint: string): Promise<void>;

    abstract getUnusedProxy(age: number, ownIp?: string): Promise<Proxy>;
}


export interface Proxy {
    proxyUrl: string;
    endpointIp: string;
    applyProxy(page: Page): Promise<void>;
}


export class EmptyProvider extends ProxyProvider {
    async createProxy(): Promise<Proxy> {
        return {
            proxyUrl: '',
            endpointIp: '',
            applyProxy: async (page) => {
                // do nothing
            }
        };
    }

    async closeProxy(endpoint: string): Promise<void> { }

    async getUnusedProxy(age: number, ownIp?: string): Promise<Proxy> {
        return {
            proxyUrl: '',
            endpointIp: '',
            applyProxy: async (page) => {
                // do nothing
            }
        };
    }
}


export const base = 'https://ips.derdorsch.de';
// const base = 'http://localhost:3000';


export async function getUnusedIp(ms: number, available: string[]): Promise<string | undefined> {
    const joined = available.filter(e => e.trim().length !== 0).join(',');
    const availableParam = joined.length > 0 ? '&available=' + joined : '';
    const url = base + '/unused-ip?ms=' + ms + availableParam;
    const res = await axios.get(url);
    return res.data.ip;
}

export async function reportGeoIssue(ip: string): Promise<void> {
    const url = base + '/geo-issue?ip=' + ip;
    await axios.get(url);
}

export async function reportAlreadyUsed(ip: string): Promise<void> {
    const url = base + '/used-issue?ip=' + ip;
    await axios.get(url);
}

export async function blockIPForOthers(ip: string): Promise<void> {
    console.log(`🟠 Blocking IP ${ip} for others`);
    const url = base + '/block-ip?ip=' + ip;
    await axios.get(url);
}

export async function unblockIPForOthers(ip: string): Promise<void> {
    const url = base + '/unblock-ip?ip=' + ip;
    await axios.get(url);
}