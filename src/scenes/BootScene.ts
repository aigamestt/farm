import Phaser from 'phaser';
import cozySpritesUrl from '../assets/cozy-sprites-source.png';
import farmerWalkUrl from '../assets/farmer-walk-source.png';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.image('cozySpritesSource', cozySpritesUrl);
    this.load.image('farmerWalkSource', farmerWalkUrl);
  }

  create(): void {
    this.createTile('grass', ['75a85f', '7fb268', '6f9f59', '89b970']);
    this.createTile('soil', ['9a704d', 'a67b55', '8d6546', 'b18761']);
    this.createTile('tilled', ['805a40', '8e6548', '745039', '9c7151']);
    this.createTile('watered', ['62534a', '716158', '584943', '7c6b61']);
    [
      ['tree', 1],
      ['rock', 2],
      ['berry', 3],
      ['cropSeed', 4],
      ['cropMature', 5],
      ['slime', 6]
    ].forEach(([key, frame]) => this.createModernSprite(String(key), Number(frame)));
    for (let frame = 0; frame < 8; frame += 1) {
      this.createWalkFrame(`playerWalk${frame}`, frame);
    }
    this.createBuildingArt();

    this.scene.start('GameScene');
  }

  private createTile(key: string, colors: string[]): void {
    const texture = this.textures.createCanvas(key, 32, 32);
    if (!texture) {
      throw new Error(`Unable to create texture: ${key}`);
    }
    const context = texture.getContext();
    context.fillStyle = `#${colors[0]}`;
    context.fillRect(0, 0, 32, 32);
    for (let index = 0; index < 22; index += 1) {
      const x = (index * 17 + 7) % 32;
      const y = (index * 23 + 11) % 32;
      context.fillStyle = `#${colors[(index % (colors.length - 1)) + 1]}`;
      context.globalAlpha = 0.24;
      context.beginPath();
      context.arc(x, y, 1 + (index % 3), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    const gradient = context.createLinearGradient(0, 0, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,.08)');
    gradient.addColorStop(1, 'rgba(0,0,0,.06)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    texture.refresh();
  }

  private createModernSprite(key: string, frame: number): void {
    const size = 128;
    const texture = this.textures.createCanvas(key, size, size);
    if (!texture) {
      throw new Error(`Unable to create texture: ${key}`);
    }
    const context = texture.getContext();
    const source = this.textures.get('cozySpritesSource').getSourceImage() as HTMLImageElement;
    const sourceWidth = source.naturalWidth / 4;
    const sourceHeight = source.naturalHeight / 2;
    const sourceX = (frame % 4) * sourceWidth;
    const sourceY = Math.floor(frame / 4) * sourceHeight;
    context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      if (red > 205 && blue > 180 && green < 100) {
        pixels.data[index + 3] = 0;
      }
    }
    context.putImageData(pixels, 0, 0);
    texture.refresh();
  }

  private createWalkFrame(key: string, frame: number): void {
    const size = 128;
    const texture = this.textures.createCanvas(key, size, size);
    if (!texture) {
      throw new Error(`Unable to create texture: ${key}`);
    }
    const context = texture.getContext();
    const source = this.textures.get('farmerWalkSource').getSourceImage() as HTMLImageElement;
    const sourceWidth = source.naturalWidth / 4;
    const sourceHeight = source.naturalHeight / 2;
    context.drawImage(
      source,
      (frame % 4) * sourceWidth,
      Math.floor(frame / 4) * sourceHeight,
      sourceWidth,
      sourceHeight,
      16,
      0,
      96,
      128
    );
    const pixels = context.getImageData(0, 0, size, size);
    for (let index = 0; index < pixels.data.length; index += 4) {
      if (
        pixels.data[index] > 205 &&
        pixels.data[index + 2] > 180 &&
        pixels.data[index + 1] < 100
      ) {
        pixels.data[index + 3] = 0;
      }
    }
    let minX = size;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (pixels.data[(y * size + x) * 4 + 3] > 20) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    const offsetX = Math.round(size / 2 - (minX + maxX) / 2);
    const offsetY = 123 - maxY;
    context.clearRect(0, 0, size, size);
    context.putImageData(pixels, offsetX, offsetY);
    texture.refresh();
  }

  private createBuildingArt(): void {
    const hut = this.textures.createCanvas('farmHut', 96, 96);
    if (!hut) throw new Error('Unable to create farm hut texture');
    const hutContext = hut.getContext();
    hutContext.fillStyle = '#dfb86d';
    hutContext.fillRect(19, 42, 58, 42);
    hutContext.fillStyle = '#466f4d';
    hutContext.beginPath();
    hutContext.moveTo(10, 46);
    hutContext.lineTo(48, 14);
    hutContext.lineTo(86, 46);
    hutContext.closePath();
    hutContext.fill();
    hutContext.fillStyle = '#294d36';
    hutContext.fillRect(42, 58, 16, 26);
    hutContext.fillStyle = '#b8dddc';
    hutContext.fillRect(26, 54, 12, 12);
    hutContext.fillRect(62, 54, 10, 12);
    hut.refresh();

    const fire = this.textures.createCanvas('campfire', 64, 64);
    if (!fire) throw new Error('Unable to create campfire texture');
    const fireContext = fire.getContext();
    fireContext.strokeStyle = '#79513a';
    fireContext.lineWidth = 7;
    fireContext.beginPath();
    fireContext.moveTo(15, 49);
    fireContext.lineTo(49, 37);
    fireContext.moveTo(15, 37);
    fireContext.lineTo(49, 49);
    fireContext.stroke();
    fireContext.fillStyle = '#f4c74e';
    fireContext.beginPath();
    fireContext.moveTo(32, 10);
    fireContext.quadraticCurveTo(52, 35, 32, 45);
    fireContext.quadraticCurveTo(11, 34, 32, 10);
    fireContext.fill();
    fireContext.fillStyle = '#ee7548';
    fireContext.beginPath();
    fireContext.moveTo(32, 21);
    fireContext.quadraticCurveTo(41, 35, 32, 40);
    fireContext.quadraticCurveTo(23, 34, 32, 21);
    fireContext.fill();
    fire.refresh();

    const workshop = this.textures.createCanvas('workshop', 96, 96);
    if (!workshop) throw new Error('Unable to create workshop texture');
    const workshopContext = workshop.getContext();
    workshopContext.fillStyle = '#8d6546';
    workshopContext.fillRect(14, 43, 68, 40);
    workshopContext.fillStyle = '#48545d';
    workshopContext.beginPath();
    workshopContext.moveTo(8, 45);
    workshopContext.lineTo(48, 18);
    workshopContext.lineTo(88, 45);
    workshopContext.closePath();
    workshopContext.fill();
    workshopContext.fillStyle = '#d9a85f';
    workshopContext.fillRect(24, 55, 18, 28);
    workshopContext.fillStyle = '#b8dddc';
    workshopContext.fillRect(58, 53, 14, 13);
    workshopContext.fillStyle = '#37434a';
    workshopContext.fillRect(70, 22, 8, 18);
    workshop.refresh();

    const tower = this.textures.createCanvas('watchtower', 96, 96);
    if (!tower) throw new Error('Unable to create watchtower texture');
    const towerContext = tower.getContext();
    towerContext.fillStyle = '#75523b';
    towerContext.fillRect(34, 30, 8, 56);
    towerContext.fillRect(54, 30, 8, 56);
    towerContext.fillStyle = '#52664d';
    towerContext.fillRect(20, 20, 56, 28);
    towerContext.fillStyle = '#34463a';
    towerContext.beginPath();
    towerContext.moveTo(14, 22);
    towerContext.lineTo(48, 6);
    towerContext.lineTo(82, 22);
    towerContext.closePath();
    towerContext.fill();
    tower.refresh();

    const greenhouse = this.textures.createCanvas('greenhouse', 96, 96);
    if (!greenhouse) throw new Error('Unable to create greenhouse texture');
    const greenhouseContext = greenhouse.getContext();
    greenhouseContext.fillStyle = 'rgba(170, 225, 211, 0.72)';
    greenhouseContext.fillRect(14, 35, 68, 48);
    greenhouseContext.strokeStyle = '#557867';
    greenhouseContext.lineWidth = 4;
    greenhouseContext.strokeRect(14, 35, 68, 48);
    greenhouseContext.beginPath();
    greenhouseContext.moveTo(14, 35);
    greenhouseContext.lineTo(48, 12);
    greenhouseContext.lineTo(82, 35);
    greenhouseContext.stroke();
    greenhouseContext.fillStyle = '#73a755';
    greenhouseContext.fillRect(24, 61, 48, 10);
    greenhouse.refresh();

    const collector = this.textures.createCanvas('waterCollector', 96, 96);
    if (!collector) throw new Error('Unable to create water collector texture');
    const collectorContext = collector.getContext();
    collectorContext.fillStyle = '#76563e';
    collectorContext.fillRect(18, 66, 60, 12);
    collectorContext.fillStyle = '#719baa';
    collectorContext.beginPath();
    collectorContext.ellipse(48, 62, 31, 13, 0, 0, Math.PI * 2);
    collectorContext.fill();
    collectorContext.fillStyle = '#b5dce2';
    collectorContext.beginPath();
    collectorContext.ellipse(48, 58, 26, 8, 0, 0, Math.PI * 2);
    collectorContext.fill();
    collectorContext.strokeStyle = '#76563e';
    collectorContext.lineWidth = 5;
    collectorContext.beginPath();
    collectorContext.moveTo(25, 62);
    collectorContext.lineTo(25, 24);
    collectorContext.lineTo(71, 24);
    collectorContext.lineTo(71, 62);
    collectorContext.stroke();
    collectorContext.fillStyle = '#52664d';
    collectorContext.fillRect(18, 18, 60, 10);
    collector.refresh();
  }
}
