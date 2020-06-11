import { Graphics, Point, Sprite, BLEND_MODES, DisplayObject, Container } from "pixi.js";
import { Interactive } from "./interactive";
import { DRAGGABLE_RADIUS } from "./constants";
import bloomImage from '../assets/images/bloom-128x128.png';

export enum DraggableState {
  HIDDEN,
  VISIBLE,
  SHRINKING,
}

export class Draggable extends Interactive {
  protected graphics: Graphics = new Graphics();
  protected dragging = false;
  public origin: Point = new Point();
  protected state: DraggableState;
  protected lastPosition: Point = new Point();
  protected pointerPos: Point;
  protected velocity: [number, number];
  protected velocityMeasurements: Array<[number, number]> = [];
  protected lastBeat: number = 0;

  constructor() {
    super();
    this.graphics
      .clear()
      .beginFill(0xffffff, 1)
      .drawCircle(0, 0, DRAGGABLE_RADIUS)
      .endFill();
    this.addChild(this.graphics);

    const bloomSprite = Sprite.from(bloomImage);
    bloomSprite.scale.set(0.7);
    bloomSprite.blendMode = BLEND_MODES.SOFT_LIGHT;
    bloomSprite.anchor.set(0.5, 0.5);

    this.addChild(bloomSprite);

    this.graphics.interactive = true;
    this.graphics
      .on('pointerdown', this.onDragStart.bind(this))
      .on('pointerup', this.onDragEnd.bind(this))
      .on('pointerupoutside', this.onDragEnd.bind(this));
  }

  adopt(newParent: Container) {
    this.parent.removeChild(this);
    newParent.addChild(this);
    this.emit('adopted', this, newParent);
  }

  setOrigin(x: number, y: number) {
    this.origin.x = x;
    this.origin.y = y;
    this.position.set(x, y);
  }

  onDragStart(e: PIXI.interaction.InteractionEvent) {
    this.dragging = true;
    this.emit("dragActive", this, e);
    this.graphics.on('pointermove', this.onDragMove.bind(this));
    document.body.classList.add("dragging");
  }

  onDragEnd(e: PIXI.interaction.InteractionEvent) {
    this.dragging = false;
    this.emit("dragInactive", this, e);
    this.graphics.off('pointermove', this.onDragMove.bind(this));
    this.emit("dragged", this, e);
    document.body.classList.remove("dragging");
  }

  onDragMove(e: PIXI.interaction.InteractionEvent) {
    if (this.dragging) {
      const newPosition = e.data.getLocalPosition(this.parent);
      this.pointerPos = new Point();
      this.pointerPos.copyFrom(newPosition);
    }
  }

  onTick(beat: number, deltaBeat: number) {
    super.onTick(beat, deltaBeat);

    if(this.pointerPos && this.dragging) {
      this.lastPosition.copyFrom(this.position);
      this.position.copyFrom(this.pointerPos);
      const velMeasurement: [number, number] = [(this.position.x - this.lastPosition.x) / deltaBeat, (this.position.y - this.lastPosition.y) / deltaBeat];
      this.velocityMeasurements.push(velMeasurement);
      // keep measurements to 5
      if(this.velocityMeasurements.length > 10) {
        this.velocityMeasurements.shift();
      }
      // Calculate avg velocity from samples
      this.velocity = [0,0];
      for (let i = 0; i < this.velocityMeasurements.length; i++) {
        this.velocity[0] += this.velocityMeasurements[i][0];
        this.velocity[1] += this.velocityMeasurements[i][1];
      }
      this.velocity[0] = this.velocity[0] / this.velocityMeasurements.length;
      this.velocity[1] = this.velocity[1] / this.velocityMeasurements.length;
    }

    const ydiff = (this.position.y - this.origin.y);
    const perspectivescale = Math.pow(2, ydiff / 200);
    this.scale.set(perspectivescale, perspectivescale)

    if(this.state === DraggableState.SHRINKING) {
      this.position.set(this.position.x + this.velocity[0] * deltaBeat / 2, this.position.y + this.velocity[1] * deltaBeat / 2);
      this.graphics.scale.set(1 - this.stateFade);
      this.alpha = 1 - this.stateFade;
      if(this.stateFade >= 1) {
        if(this.parent) {
          this.parent.removeChild(this);
        }
        this.destroy();
      }
    }
  }

  multiplierResize(m: number) {}

  setState(newState: DraggableState, value: number) {
    if(newState === DraggableState.SHRINKING) {
      this.stateFadeTime = 0.5;
      this.stateFade = 1 - this.scale.x;
    }
    this.state = newState;
  }

}