export default (options = {}) => {
  let startX, startY, timeoutId;

  const {
    element = () => {},
    callback = () => {},
    startCallback = () => {},
    moveCallback = () => {},
    endCallback = () => {},
    preventScroll = false
  } = options;

  const dragMove = (event) => {
    if (preventScroll) {
      event.preventDefault(); // prevent drag scrolling
    }
    clearTimeout(timeoutId);
    const pageX = event.pageX || event.touches[0].pageX;
    const pageY = event.pageY || event.touches[0].pageY;
    const diff = {
      x: pageX - startX,
      y: pageY - startY,
      ...options
    };
    callback(diff);
    moveCallback(diff);
  };

  const dragEnd = ({ pageX, pageY }) => {
    clearTimeout(timeoutId);
    const diff = {
      x: pageX - startX,
      y: pageY - startY,
      ...options
    };
    callback(diff);
    endCallback(diff);
    removeListeners();
  };

  const dragStart = (event) => {
    clearTimeout(timeoutId);
    startX = event.pageX || event.touches[0].pageX;;
    startY = event.pageY || event.touches[0].pageY;;
    const diff = {
      x: 0,
      y: 0,
      ...options
    };
    startCallback(diff);
    window.addEventListener('mousemove', dragMove, {passive:!preventScroll});
    window.addEventListener('mouseup', dragEnd, {passive:!preventScroll});
    window.addEventListener('touchmove', dragMove, {passive:!preventScroll});
    window.addEventListener('touchend', dragEnd, {passive:!preventScroll});
    // window.addEventListener('mouseout', dragEnd);
  };

  const removeListeners = () => {
    window.removeEventListener('mousemove', dragMove);
    window.removeEventListener('mouseup', dragEnd);
    window.removeEventListener('touchmove', dragMove);
    window.removeEventListener('touchend', dragEnd);
    // window.removeEventListener('mouseout', dragEnd);
  };

  element.addEventListener('mousedown', dragStart, {passive:!preventScroll});
  element.addEventListener('touchstart', dragStart, {passive:!preventScroll});

  // Return removeListeners for cleanup
  return ()=>{
    element.removeEventListener('mousedown', dragStart);
    removeListeners();
  }
};
