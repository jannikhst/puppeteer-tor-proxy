function wait(minDelay, maxDelay) {
    const delay = Math.random() * (maxDelay - minDelay) + minDelay;
    return new Promise(resolve => setTimeout(resolve, delay));
}


async function clickOnButtonWithText(text) {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
        var buttonInnerText = buttons[i].innerText.trim();
        if (buttonInnerText === text) {
            buttons[i].click();
            await wait(800, 1500);
            break;
        }
    }
}

(async function () {
    while (true) {
        await clickOnButtonWithText('Jetzt abstimmen');
        await wait(1600, 3000);
        await clickOnButtonWithText('Hier klicken zum Start');
        await wait(1000, 2500);
        const UNSTARTED = '.UNSTARTED';
        let value = UNSTARTED;
        while (value === UNSTARTED || value === '.UNFINISHED') {
            value = document.querySelector('.frc-captcha-solution').value;
            await wait(1000, 2000);
        }
        await wait(1000, 4000);
        await clickOnButtonWithText('Stimme abgeben');
        await wait(63000, 65000);
    }
})();


function wait(t,a){var e=Math.random()*(a-t)+t;return new Promise(t=>setTimeout(t,e))}async function clickOnButtonWithText(t){for(var a=document.querySelectorAll("button"),e=0;e<a.length;e++)if(a[e].innerText.trim()===t){a[e].click(),await wait(800,1500);break}}!async function(){for(;;){await clickOnButtonWithText("Jetzt abstimmen"),await wait(1600,3e3),await clickOnButtonWithText("Hier klicken zum Start"),await wait(1e3,2500);var a=".UNSTARTED";let t=a;for(;t===a||".UNFINISHED"===t;)t=document.querySelector(".frc-captcha-solution").value,await wait(1e3,2e3);await wait(1e3,4e3),await clickOnButtonWithText("Stimme abgeben"),await wait(63e3,65e3)}}();





function fromBinary(r){const n=atob(r),t=new Uint8Array(n.length);for(let r=0;r<t.length;r++)t[r]=n.charCodeAt(r);return String.fromCharCode(...new Uint16Array(t.buffer))}


    const encoded = 'ZgB1AG4AYwB0AGkAbwBuACAAdwBhAGkAdAAoAHQALABhACkAewB2AGEAcgAgAGUAPQBNAGEAdABoAC4AcgBhAG4AZABvAG0AKAApACoAKABhAC0AdAApACsAdAA7AHIAZQB0AHUAcgBuACAAbgBlAHcAIABQAHIAbwBtAGkAcwBlACgAdAA9AD4AcwBlAHQAVABpAG0AZQBvAHUAdAAoAHQALABlACkAKQB9AGEAcwB5AG4AYwAgAGYAdQBuAGMAdABpAG8AbgAgAGMAbABpAGMAawBPAG4AQgB1AHQAdABvAG4AVwBpAHQAaABUAGUAeAB0ACgAdAApAHsAZgBvAHIAKAB2AGEAcgAgAGEAPQBkAG8AYwB1AG0AZQBuAHQALgBxAHUAZQByAHkAUwBlAGwAZQBjAHQAbwByAEEAbABsACgAIgBiAHUAdAB0AG8AbgAiACkALABlAD0AMAA7AGUAPABhAC4AbABlAG4AZwB0AGgAOwBlACsAKwApAGkAZgAoAGEAWwBlAF0ALgBpAG4AbgBlAHIAVABlAHgAdAAuAHQAcgBpAG0AKAApAD0APQA9AHQAKQB7AGEAWwBlAF0ALgBjAGwAaQBjAGsAKAApACwAYQB3AGEAaQB0ACAAdwBhAGkAdAAoADgAMAAwACwAMQA1ADAAMAApADsAYgByAGUAYQBrAH0AfQAhAGEAcwB5AG4AYwAgAGYAdQBuAGMAdABpAG8AbgAoACkAewBmAG8AcgAoADsAOwApAHsAYQB3AGEAaQB0ACAAYwBsAGkAYwBrAE8AbgBCAHUAdAB0AG8AbgBXAGkAdABoAFQAZQB4AHQAKAAiAEoAZQB0AHoAdAAgAGEAYgBzAHQAaQBtAG0AZQBuACIAKQAsAGEAdwBhAGkAdAAgAHcAYQBpAHQAKAAxADYAMAAwACwAMwBlADMAKQAsAGEAdwBhAGkAdAAgAGMAbABpAGMAawBPAG4AQgB1AHQAdABvAG4AVwBpAHQAaABUAGUAeAB0ACgAIgBIAGkAZQByACAAawBsAGkAYwBrAGUAbgAgAHoAdQBtACAAUwB0AGEAcgB0ACIAKQAsAGEAdwBhAGkAdAAgAHcAYQBpAHQAKAAxAGUAMwAsADIANQAwADAAKQA7AHYAYQByACAAYQA9ACIALgBVAE4AUwBUAEEAUgBUAEUARAAiADsAbABlAHQAIAB0AD0AYQA7AGYAbwByACgAOwB0AD0APQA9AGEAfAB8ACIALgBVAE4ARgBJAE4ASQBTAEgARQBEACIAPQA9AD0AdAA7ACkAdAA9AGQAbwBjAHUAbQBlAG4AdAAuAHEAdQBlAHIAeQBTAGUAbABlAGMAdABvAHIAKAAiAC4AZgByAGMALQBjAGEAcAB0AGMAaABhAC0AcwBvAGwAdQB0AGkAbwBuACIAKQAuAHYAYQBsAHUAZQAsAGEAdwBhAGkAdAAgAHcAYQBpAHQAKAAxAGUAMwAsADIAZQAzACkAOwBhAHcAYQBpAHQAIAB3AGEAaQB0ACgAMQBlADMALAA0AGUAMwApACwAYQB3AGEAaQB0ACAAYwBsAGkAYwBrAE8AbgBCAHUAdAB0AG8AbgBXAGkAdABoAFQAZQB4AHQAKAAiAFMAdABpAG0AbQBlACAAYQBiAGcAZQBiAGUAbgAiACkALABhAHcAYQBpAHQAIAB3AGEAaQB0ACgANgAzAGUAMwAsADYANQBlADMAKQB9AH0AKAApADsA';
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    eval(String.fromCharCode(...new Uint16Array(bytes.buffer)));




fetch("https://www.antenne.de/programm/aktionen/pausenhofkonzerte/danke-fuer-deine-stimme", {
  "headers": {
    "accept": "*/*",
    "accept-language": "de-DE,de;q=0.9",
    "cache-control": "max-age=0",
    "content-type": "multipart/form-data; boundary=----WebKitFormBoundaryB1rYAt7ut0nuGanZ",
    "sec-ch-ua": "\"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"114\", \"Google Chrome\";v=\"114\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "same-origin",
    "sec-fetch-site": "same-origin",
    "x-thisisfromnaviationhandler": "true"
  },
  "referrer": "https://www.antenne.de/programm/aktionen/pausenhofkonzerte/abstimmen",
  "referrerPolicy": "strict-origin-when-cross-origin",
  "body": "------WebKitFormBoundaryB1rYAt7ut0nuGanZ\r\nContent-Disposition: form-data; name=\"formid\"\r\n\r\nphkvote\r\n------WebKitFormBoundaryB1rYAt7ut0nuGanZ\r\nContent-Disposition: form-data; name=\"s\"\r\n\r\n10782\r\n------WebKitFormBoundaryB1rYAt7ut0nuGanZ\r\nContent-Disposition: form-data; name=\"form_session_id\"\r\n\r\n\r\n------WebKitFormBoundaryB1rYAt7ut0nuGanZ\r\nContent-Disposition: form-data; name=\"nua\"\r\n\r\nMozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36\r\n------WebKitFormBoundaryB1rYAt7ut0nuGanZ\r\nContent-Disposition: form-data; name=\"vh\"\r\n\r\n22b57ca8a5dcb049d2e8e30a196f39d9dd24deb3427fdd2f3beab1bdfe7b9f2b57344105d0bd55c9878ad8f9ba7a936447c32fe519e6c4a84a828a648d0bf558\r\n------WebKitFormBoundaryB1rYAt7ut0nuGanZ\r\nContent-Disposition: form-data; name=\"vt\"\r\n\r\n255132908\r\n------WebKitFormBoundaryB1rYAt7ut0nuGanZ\r\nContent-Disposition: form-data; name=\"frc-solution\"\r\n\r\n15ec0995f952bb2bc4f5a1b7445c8555.ZKQE8uZmj7GZSsQxAQwzmQAAAAAAAAAAFYk/H8c5yNU=.AAAAAH9wBAABAAAAO+8LAAIAAADB6wQAAwAAAHMNAAAEAAAAVukLAAUAAADFWwUABgAAAJ2/BgAHAAAA66MXAAgAAAAENREACQAAAHExAAAKAAAAe7MIAAsAAADKXQcADAAAADHOAAANAAAAPcoFAA4AAABb9gkADwAAAOmwFQAQAAAADMoEABEAAABwOQcAEgAAAHydFQATAAAAAk0SABQAAABTPQsAFQAAANNfCwAWAAAAI5YSABcAAABgqAsAGAAAADSyAgAZAAAAjQcFABoAAACp7BwAGwAAAJbmEgAcAAAA21AbAB0AAABO4AEAHgAAAOUbCAAfAAAAEz4sACAAAABDXgMAIQAAAB6VBwAiAAAA54RSACMAAACR8wIAJAAAAJdtBAAlAAAA3xkAACYAAAD1SAoAJwAAAKIkBwAoAAAAA60AACkAAACBbxwAKgAAAPgaHQArAAAAD+8BACwAAACBAxAALQAAABxQAQAuAAAAQRcFAC8AAADRiQMAMAAAAE5NAQAxAAAAQ28DADIAAABwFwwA.AQAT\r\n------WebKitFormBoundaryB1rYAt7ut0nuGanZ--\r\n",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});