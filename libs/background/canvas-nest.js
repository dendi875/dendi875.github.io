!function(){for(var n=navigator.userAgent,e=["iPad","iPhone","Android","SymbianOS","Windows Phone","iPod","webOS","BlackBerry","IEMobile"],t=0;t<e.length;t++)if(0<n.indexOf(e[t]))return;function i(n,e,t){return n.getAttribute(e)||t}function o(n){return document.getElementsByTagName(n)}function a(){u=l.width=window.innerWidth||document.documentElement.clientWidth||document.body.clientWidth,m=l.height=window.innerHeight||document.documentElement.clientHeight||document.body.clientHeight}function c(){h.clearRect(0,0,u,m);var e,t,i,o,a,d=[v].concat(p);p.forEach(function(n){for(n.x+=n.xa,n.y+=n.ya,n.xa*=n.x>u||n.x<0?-1:1,n.ya*=n.y>m||n.y<0?-1:1,h.fillRect(n.x-.5,n.y-.5,1,1),t=0;t<d.length;t++)n!==(e=d[t])&&null!==e.x&&null!==e.y&&(i=n.x-e.x,o=n.y-e.y,(a=i*i+o*o)<e.max)&&(e===v&&a>=e.max/2&&(n.x-=.03*i,n.y-=.03*o),i=(e.max-a)/e.max,h.beginPath(),h.lineWidth=i/2,h.strokeStyle="rgba("+y+","+(.2+i)+")",h.moveTo(n.x,n.y),h.lineTo(e.x,e.y),h.stroke());d.splice(d.indexOf(n),1)}),g(c)}var u,m,d,l=document.createElement("canvas"),r=f=(d=o("script")).length,x=i(d=d[f-1],"zIndex",-1),w=i(d,"opacity",.5),y=i(d,"color","0,0,0"),s=i(d,"count",99),f="c_n"+r,h=l.getContext("2d"),g=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(n){window.setTimeout(n,1e3/45)},b=Math.random,v={x:null,y:null,max:2e4};l.id=f,l.style.cssText="position:fixed;top:0;left:0;z-index:"+x+";opacity:"+w,o("body")[0].appendChild(l),a(),window.onresize=a,window.onmousemove=function(n){n=n||window.event,v.x=n.clientX,v.y=n.clientY},window.onmouseout=function(){v.x=null,v.y=null};for(var p=[],A=0;A<s;A++){var E=b()*u,R=b()*m,T=2*b()-1,q=2*b()-1;p.push({x:E,y:R,xa:T,ya:q,max:6e3})}setTimeout(function(){c()},100)}();