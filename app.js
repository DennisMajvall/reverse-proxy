process.chdir(__dirname);
const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;

const proxy = httpProxy.createProxyServer({});

const ports = {
  ez: 3000,
  test: 3001,
  test2: 4000,
  test3: 4000
}

const certBotPort = 5000;
const certPath = '/etc/letsencrypt/live'

let certs = readCerts();

proxy.on('error', function(e) {
  console.log('___Proxy error___', e);
});

function setResponseHeaders(res){
  const oldWriteHead = res.writeHead.bind(res);
  res.writeHead = (statusCode, headers)=>{
    res.setHeader('x-powered-by', 'majvall');
    res.setHeader('strict-transport-security','max-age=31536000; includeSubDomains; preload');
    res.setHeader('x-frame-options','SAMEORIGIN');
    res.setHeader('x-xss-protection', '1');
    res.setHeader('x-content-type-options','nosniff');
    // Lägg bara till unsafe-inline och unsafe-eval om ni behöver et
    res.setHeader('content-security-policy',"default-src * 'unsafe-inline' 'unsafe-eval'");
    oldWriteHead(statusCode, headers);
  };
}

https.createServer({
  SNICallback: (domain, cb) => cb(
    (certs[domain] ? null : new Error("No such cert")),
    (certs[domain] ? certs[domain].secureContext : null)
  ),
  key: certs['test.majvall.se'].key,
  cert: certs['test.majvall.se'].cert
}, (req, res)=>{
  setResponseHeaders(res);

  const host = req.headers.host; // test.majvall.se/index
  const domains = host.split('.'); // [ 'test', 'majvall', 'se' ]

  if (domains[0] == 'www') {
    let url = 'https://' + domains.slice(1).join('.') + req.url;
    res.writeHead(301, {'Location': url});
    res.end();
    return;
  }

  const topDomain = domains.pop(); // se
  const domain = domains.pop(); // majvall
  const subdomain = domains.join('.'); // test

  const pathname = req.url; // index

  let port = ports[subdomain];

  if (!port) {
    res.statusCode = 404;
    res.end('Wrong subdomain. ' + subdomain);
    return;
  }

  proxy.web(req, res, { target: 'http://127.0.0.1:' + port });
}).listen(443, ()=>{
  console.log('Proxy listening on port 443');
});

http.createServer((req, res)=>{
  if (req.url.indexOf('/.well-known') == 0){
    proxy.web(req, res, { target: 'http://127.0.0.1:' + certBotPort });
    return;
  }

  const url = 'https://' + req.headers.host + req.url;
  res.writeHead(301, {'Location': url});
  res.end();
}).listen(80, ()=>{
  console.log('Proxy listening on port 80');
});


function readCerts() {
  let certs = {},
      domains = fs.readdirSync(certPath);

  // REAL ALL SSL CERTS INTO MEMORY FROM FILE
  for (let domain of domains) {
    let domainName = domain.split('-0')[0];
    certs[domainName] = {
      key: fs.readFileSync(path.join(certPath,domain,'privkey.pem')),
      cert: fs.readFileSync(path.join(certPath,domain,'fullchain.pem'))
    };

    certs[domainName].secureContext = tls.createSecureContext(certs[domainName]);
  }

  return certs;
}

function renewCerts(){
  exec('certbot renew', (err, stdOut, stdErr)=>{
    console.log('renewing certs');//, stdOut);
    certs = readCerts();
  });
}

renewCerts();
setInterval(renewCerts, 24*60*60*1000);
// certbot certonly --webroot -w /var/www/html -d test.majvall.se