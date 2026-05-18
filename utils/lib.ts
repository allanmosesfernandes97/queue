export const sleep = (ms: number = 1000) => {
    console.log('sleep started')
    return new Promise(resolve => setTimeout(resolve, ms));
}