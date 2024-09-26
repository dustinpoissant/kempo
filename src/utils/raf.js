const raf = (callback, frames = 1) => {
  requestAnimationFrame(()=>{
    if(frames === 1){
      callback();
    } else {
      raf(callback, frames-1);
    }
  });
}
export default raf;