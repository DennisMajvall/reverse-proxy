process.chdir(__dirname);
const http = require('http');
const httpProxy = require('http-proxy');
const tls = require('tls');
const fs = require('fs');

const proxy = httpProxy.createProxyServer({});

const ports = {
  ez: 3000,
  test: 3001,
  test2: 4000
}

const certBotPort = 5000;
const certPath = '/etc/letsencrypt/live'

let certs = readCerts();
console.log(certs);

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

http.createServer(function(req, res) {
  setResponseHeaders(res);

  const host = req.headers.host; // test.majvall.se/index
  const domains = host.split('.');
  if (domains[0] == 'www') { domains.shift(1); }

  const topDomain = domains.pop(); // se
  const domain = domains.pop(); // majvall
  const subDomain = domains.join('.'); // test

  const pathname = req.url; // index


  let port = false;

  if (pathname.indexOf('/.well-known') == 0){
    port = certBotPort;
  }

  !port && (port = ports[subDomain]);

  if (!port) {
    res.statusCode = 500;
    res.end('Wrong sub-domain. ' + subDomain);
    return;
  }

  proxy.web(req, res, { target: 'http://127.0.0.1:' + port });
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
