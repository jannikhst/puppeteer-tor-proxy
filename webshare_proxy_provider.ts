import axios from "axios";
import { Proxy, ProxyProvider, getUnusedIp } from "./proxy_provider";
import useProxy from "puppeteer-page-proxy";
import { wait } from "./action";

export class WebshareProxyProvider extends ProxyProvider {
    private fetchProxiesUrl: string;
    private proxies: { [key: string]: Proxy } = {};
    private lastfetch: Date | undefined = undefined;

    constructor(fetchProxiesUrl: string) {
        super();
        this.fetchProxiesUrl = fetchProxiesUrl;
    }


    async closeProxy(endpoint: string): Promise<void> { }

    async createProxy(): Promise<any> {
        if (this.lastfetch) {
            const now = new Date();
            const diff = now.getTime() - this.lastfetch.getTime();
            // only fetch if last fetch was more than 15 minutes ago
            if (diff < 15 * 60 * 1000) {
                await wait(3000);
                return;
            }
        }

        // load all proxies from txt file
        // format: ip:port:username:password
        const res = await axios.get(this.fetchProxiesUrl);
        this.lastfetch = new Date();
        const lines = res.data.split('\n') as string[];
        const formatted = lines.map(l => formatSocks5Url(l));
        for (const format of formatted) {
            // build proxy object and add it to proxies
            const proxy: Proxy = {
                proxyUrl: format.proxyUrl,
                endpointIp: format.endpointIp,
                applyProxy: async (page) => {
                    await useProxy(page, format.proxyUrl);
                }
            };
            this.proxies[format.endpointIp] = proxy;
        }
        console.log(`🟢  Prepared ${formatted.length} connections.`);
    }


    async getUnusedProxy(age: number, ownIp?: string | undefined): Promise<Proxy> {
        const availableProxies = Object.keys(this.proxies);
        if (ownIp) {
            availableProxies.push(ownIp);
        }
        console.log(`🟢  Looking for unused proxy (age: ${age}ms)`);
        const ip = await getUnusedIp(age, availableProxies);
        console.log(`🟢  Found unused proxy ${ip}`);
        if (ip !== undefined && ip === ownIp) {
            // we can use our own IP
            console.log(`🟢 📣  Using own IP ${ip}`);
            return {
                proxyUrl: '',
                endpointIp: ip,
                applyProxy: async (page) => {
                    // do nothing
                }
            };
        }
        if (ip) {
            console.log(`🛜  Reusing proxy ${ip}`);
            return this.proxies[ip];
        }
        await this.createProxy();
        return this.getUnusedProxy(age, ownIp);
    }
}


function formatSocks5Url(input: string): { proxyUrl: string, endpointIp: string } {
    const [ip, port, username, password] = input.split(":");
    const baseUrl = `socks5://${username}:${password}@${ip}:${port}`;
    const endpointIp = ip;
    return { proxyUrl: baseUrl, endpointIp };
}