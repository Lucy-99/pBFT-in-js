function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function hello() {
  await timeout(3000);
  console.log("hello");
}

hello();
console.log("b");
