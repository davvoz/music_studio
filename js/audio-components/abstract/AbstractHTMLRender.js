export class AbstractHTMLRender {
  constructor() {
    this.container = document.createElement('div');
    this.container.classList.add('audio-component');
  }

  render() {
    return this.container;
  }

  addCopyPasteControls(container) {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'copy-paste-controls';
    controlsDiv.innerHTML = `
        <div class="sequence-tools">
            <button class="copy-btn" title="Copy 8 steps">COPY</button>
            <button class="paste-btn" disabled title="Paste 8 steps">PASTE</button>
            <select class="block-selector">
                <option value="0">1-8</option>
                <option value="8">9-16</option>
                <option value="16">17-24</option>
                <option value="24">25-32</option>
            </select>
        </div>
    `;

    let clipboardData = null;
    const copyBtn = controlsDiv.querySelector('.copy-btn');
    const pasteBtn = controlsDiv.querySelector('.paste-btn');
    const blockSelector = controlsDiv.querySelector('.block-selector');

    copyBtn.addEventListener('click', () => {
        const startStep = parseInt(blockSelector.value);
        clipboardData = this.copySteps(startStep, startStep + 8);
        pasteBtn.disabled = false;
    });

    pasteBtn.addEventListener('click', () => {
        if (!clipboardData) return;
        const targetStep = parseInt(blockSelector.value);
        this.pasteSteps(clipboardData, targetStep);
    });

    container.insertBefore(controlsDiv, container.firstChild);
  }

  copySteps(start, end) {
    // Questo metodo deve essere implementato dalle classi figlie
    return null;
  }

  pasteSteps(data, targetStep) {
    // Questo metodo deve essere implementato dalle classi figlie
    return null;
  }
}