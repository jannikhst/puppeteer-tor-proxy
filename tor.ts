// run /usr/local/opt/tor/bin/tor

import { spawn, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export class TorInstance {
    close: () => Promise<void>;
    proxyIp: string;
    port: number;
    info: ApiIpResult;

    constructor(close: () => Promise<void>, ip: string, port: number, info: ApiIpResult) {
        this.close = close;
        this.proxyIp = ip;
        this.port = port;
        this.info = info;
    }

    get proxyUrl() {
        return `socks5://${this.proxyIp}:${this.port}`;
    }

    static async existsInstance(): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            // ps aux | grep '/usr/bin/tor -f /app/torrc' | grep -v grep | awk '{print $1}
            exec(`ps aux | grep '/bin/tor -f ${path.join(__dirname, 'torrc')}'`, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                    return;
                }
                // stdout will be multiple lines, remove every line that contains grep
                let lines = stdout.split('\n');
                lines = lines.filter(l => !l.includes('grep'));
                lines = lines.filter(l => l.trim().length > 0);
                if (lines.length > 0) {
                    const fragments = lines[0].split(' ');
                    try {
                        const pid = parseInt(fragments[1].trim());
                        resolve(pid);
                    } catch (error) {
                        resolve(-1);
                    }

                } else {
                    resolve(-1);
                }
            });
        });
    }

    static async waitTillTorStopped(): Promise<void> {
        while (true) {
            const pid = await TorInstance.existsInstance();
            if (pid < 0) {
                return;
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 500));
        }
    }


    static async create(locales?: string[]): Promise<TorInstance> {

        const nodes = (locales ?? ['de']).map(l => `{${l}}`).join(',');

        const torrcPath = path.join(__dirname, 'torrc');
        try {
            await fs.writeFile(torrcPath, 'ExitNodes ' + nodes + '\nStrictNodes 1\n');
        } catch (e) {
        }

        const torPath = await execPromise('which tor');

        // run tor in a child process and wait till stdout contains "100%"
        const filePath = path.join(__dirname, 'torrc');
        const tor = spawn(torPath.trim(), ['-f', filePath]);
        let ip = '';
        let port = 0;
        let pid: number | undefined;
        await new Promise<void>((resolve, reject) => {
            let up = false;
            tor.stdout.on('data', (data) => {
                const text = data.toString();
                if (text.includes('100%')) {
                    up = true;
                    resolve();
                }
                const match2 = text.match(/Opening Socks listener on (.+):(\d+)/g);
                if (match2) {
                    const parts = match2[0].split(' ');
                    ip = parts[4].split(':')[0];
                    port = parseInt(parts[4].split(':')[1]);
                }
            });
            tor.on('close', async (code) => {
                await new Promise<void>((resolve) => setTimeout(resolve, 500));
                if (up) {
                    return;
                }
                console.log('tor is already running, looking for pid');
                const pid = await TorInstance.existsInstance();
                if (pid > 0) {
                    resolve();
                    return;
                }
            });
        });

        const curlCmd = `curl --socks5 ${ip + ':' + port} --socks5-hostname ${ip + ':' + port} -s http://ip-api.com/json/`;

        const start = Date.now();
        const res = await execPromise(curlCmd);
        const json = JSON.parse(res);
        const api = ApiIpResult.fromJson(json);
        // if api is localhost or something, try again


        const end = Date.now();

        console.log(`Proxy working. Ping: ${end - start}ms`);

        if (pid) {
            return new TorInstance(() => {
                return new Promise<void>(async (resolve, reject) => {
                    await execPromise(`kill ${pid}`);
                    await TorInstance.waitTillTorStopped();
                    resolve();
                });
            }, ip, port, api);
        }
        return new TorInstance(async () => {
            tor.kill();
            await TorInstance.waitTillTorStopped();
        }, ip, port, api);
    }
}



async function execPromise(command: string) {
    return new Promise<string>((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(stdout);
        });
    });
}


class ApiIpResult {
    status: string;
    country: string;
    countryCode: string;
    region: string;
    regionName: string;
    city: string;
    zip: string;
    lat: number;
    lon: number;
    timezone: string;
    isp: string;
    org: string;
    as: string;
    query: string;

    constructor(status: string, country: string, countryCode: string, region: string, regionName: string, city: string, zip: string, lat: number, lon: number, timezone: string, isp: string, org: string, as: string, query: string) {
        this.status = status;
        this.country = country;
        this.countryCode = countryCode;
        this.region = region;
        this.regionName = regionName;
        this.city = city;
        this.zip = zip;
        this.lat = lat;
        this.lon = lon;
        this.timezone = timezone;
        this.isp = isp;
        this.org = org;
        this.as = as;
        this.query = query;
    }

    static fromJson(json: any): ApiIpResult {
        return new ApiIpResult(json.status, json.country, json.countryCode, json.region, json.regionName, json.city, json.zip, json.lat, json.lon, json.timezone, json.isp, json.org, json.as, json.query);
    }

    get ip() {
        return this.query;
    }

    get info() {
        // [ip] country, region, city
        return `[${this.ip}]: ${this.country}, ${this.region}, ${this.city}`;
    }
}