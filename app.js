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
  test2: 4000
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
  const domains = host.split('.');

  if (domains[0] == 'www') {

    console.log('it is www', domains);

    let url = domains.slice(1).join('.') + req.url;
    url = 'hej.majvall.se';
    res.writeHead(301, {'Location': url});

    console.log('removing www, result:', url);

    res.end();
    return;

  } else {
    console.log('it is not www', domains);
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
    console.log('renewing certs', stdOut);
    certs = readCerts();
  });
}

// renewCerts();
setInterval(renewCerts, 24*60*60*1000);