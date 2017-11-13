const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

proxy.on('error', function(e) {
  console.log('___Proxy error___', e);
});

const ports = {
  www: 3000,
  test: 3000,
  test2: 3000
}

http.createServer(function(req, res) {
  const host = req.headers.host; // test.majvall.se/index
  const domains = host.split('.');

  const topDomain = domains.pop(); // se
  const domain = domains.pop(); // majvall
  const subDomain = domains.join('.'); // test

  const pathname = req.url; // index

  const port = ports[subDomain];

  if (!port) {
    res.statusCode = 500;
    res.end('Wrong sub-domain. ' + subDomain);
    return;
  }

  proxy.web(req, res, { target: 'http://127.0.0.1:' + port });
}).listen(80, ()=>{
  console.log('Proxy listening on port 80');
});