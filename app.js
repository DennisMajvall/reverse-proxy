process.chdir(__dirname);
process.on('unhandledRejection', console.log);
const http = require('http'),
  https = require('https'),
  httpProxy = require('http-proxy'),
  tls = require('tls'),
  fs = require('fs'),
  path = require('path'),
  exec = require('child_process').exec,
  routes = require('./routes.json');

const proxy = httpProxy.createProxyServer({});
proxy.on('error', function(e) { console.log('___Proxy error___', e); });

const certBotPort = 5000;
const certPath = '/etc/letsencrypt/live';
let certs = readCerts();

// https.createServer({
//   SNICallback: (domain, cb) => cb(
//     (certs[domain] ? null : new Error("No such cert")),
//     (certs[domain] ? certs[domain].secureContext : null)
//   ),
//   key: certs['test.majvall.se'].key,
//   cert: certs['test.majvall.se'].cert
// }, (req, res)=>{
//   setResponseHeaders(res);

//   let portToUse = getRouteFromJSON(req);

//   if (!portToUse) {
//     res.statusCode = 404;
//     res.end('Wrong subdomain: ' + req.headers.host);
//   }
//   else if (typeof portToUse == 'string'){
//     // proxy.web(req,res,{target: {host:'ip.addr.here',port:80}});
//     proxy.web(req, res, { target: portToUse });
//   }
//   else if (typeof portToUse == 'number'){
//     proxy.web(req, res, { target: 'http://127.0.0.1:' + portToUse });
//   }
//   else if (portToUse.redirect){
//     let url = 'https://' + portToUse.redirect + req.url;
//     res.writeHead(301, {'Location': url});
//     res.end();
//   }
//   else {
//     res.send('Error in routing');
//   }

// }).listen(443, ()=>{
//   console.log('Proxy listening on port 443');
// });

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

function getRouteFromJSON(req){
  let portToUse;
  const host = req.headers.host;
  let url = req.url + (req.url.substr(-1) != '/' ? '/' : '')

  for(let route in routes){
    let port = routes[route];
    if(route.includes('/')){ route += (route.substr(-1) != '/' ? '/' : '') }

    if(route == host){ portToUse = port; }
    else if (url != '/' && (host + url).indexOf(route) == 0){ portToUse = port; }
  }
  return portToUse;
}

function setResponseHeaders(res){
  const oldWriteHead = res.writeHead.bind(res);
  res.writeHead = (statusCode, headers)=>{
    res.setHeader('x-powered-by', 'botall');
    res.setHeader('strict-transport-security','max-age=31536000; includeSubDomains; preload');
    res.setHeader('x-frame-options','SAMEORIGIN');
    res.setHeader('x-xss-protection', '1');
    res.setHeader('x-content-type-options','nosniff');
    // Lägg bara till unsafe-inline och unsafe-eval om ni behöver et
    res.setHeader('content-security-policy',"default-src * 'unsafe-inline' 'unsafe-eval'");
    oldWriteHead(statusCode, headers);
  };
}

// Certbot

(()=>{
  const express = require('express');
  express().use(express.static('/var/www/html')).listen(certBotPort);
})();

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

// renewCerts();
setInterval(renewCerts, 24*60*60*1000);
// certbot certonly --webroot -w /var/www/html -d test.majvall.se
