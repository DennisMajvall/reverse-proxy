const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

const ports = {
  ez: 3000,
  test: 3001,
  test2: 4000
}

proxy.on('error', function(e) {
  console.log('___Proxy error___', e);
});

function setResponseHeaders(res){
  const oldWriteHead = res.writeHead;
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