'use strict';
const fs = require('node:fs');
const zlib = require('node:zlib');

// Decode the checked-in, 8-bit RGBA pack without a browser or npm dependency.
module.exports = function png(file) {
  const data = fs.readFileSync(file), chunks = [];
  let width, height;
  for (let i=8;i<data.length;) {
    const length=data.readUInt32BE(i), type=data.toString('ascii',i+4,i+8);
    if(type==='IHDR') {
      width=data.readUInt32BE(i+8);height=data.readUInt32BE(i+12);
      if(data[i+16]!==8||data[i+17]!==6||data[i+20]!==0)throw new Error('Expected non-interlaced RGBA8');
    }
    if(type==='IDAT')chunks.push(data.subarray(i+8,i+8+length));
    i+=length+12;
  }
  const raw=zlib.inflateSync(Buffer.concat(chunks)), rgba=Buffer.alloc(width*height*4);
  const stride=width*4;
  const paeth=(a,b,c)=>{
    const p=a+b-c, pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
    return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
  };
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];
    if(filter>4)throw new Error('Invalid PNG filter');
    for(let x=0;x<stride;x++){
      const i=y*stride+x,a=x>=4?rgba[i-4]:0,b=y?rgba[i-stride]:0,c=y&&x>=4?rgba[i-stride-4]:0;
      const predictor=filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0;
      rgba[i]=(raw[y*(stride+1)+1+x]+predictor)&255;
    }
  }
  return {width,height,rgba};
};
