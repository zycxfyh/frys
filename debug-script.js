import path from 'path';

console.log('import.meta.url:', import.meta.url);
console.log('process.argv[1]:', process.argv[1]);
console.log('endsWith check:', import.meta.url.endsWith(process.argv[1]));

// 尝试不同的检查方式
const url = new URL(import.meta.url);
const argvPath = path.resolve(process.argv[1]);
console.log('URL pathname:', url.pathname);
console.log('resolved argv:', argvPath);
console.log('pathname === resolved:', url.pathname === argvPath);
