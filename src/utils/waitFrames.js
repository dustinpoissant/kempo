export default (frameCount = 1) => {
  return new Promise((resolve) => {
    let frames = 0;

    function frameHandler() {
      frames++;

      if (frames >= frameCount) {
        resolve();
      } else {
        requestAnimationFrame(frameHandler);
      }
    }

    requestAnimationFrame(frameHandler);
  });
}