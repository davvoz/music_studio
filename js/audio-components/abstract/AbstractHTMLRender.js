export class AbstractHTMLRender {
  constructor() {
    this.container = document.createElement('div');
    this.container.classList.add('audio-component');
  }

  render() {
    return this.container;
  }
}