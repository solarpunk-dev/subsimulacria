import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { fromEvent } from 'rxjs';
import { EngineService } from './engine.service';

@Component({
  selector: 'app-engine',
  templateUrl: './engine.component.html'
})
export class EngineComponent implements OnInit {

  @ViewChild('rendererCanvas', { static: true })
  public rendererCanvas: ElementRef<HTMLCanvasElement>;

  public constructor(private engServ: EngineService) { }

  public ngOnInit(): void {
    this.engServ.createScene(this.rendererCanvas);
    this.engServ.animate();

    const mouseMoves = fromEvent(document, 'mousemove');
    const mousesub = mouseMoves.subscribe((evt: MouseEvent) => {
      this.engServ.handleMouseMove(evt);
    });

    const keyPresses = fromEvent(document, 'keypress');
    const keysub = keyPresses.subscribe((evt: KeyboardEvent) => {
      this.engServ.handleKeypress(evt);
    });
  }
}
