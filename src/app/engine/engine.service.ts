import { WindowRefService } from './../services/window-ref.service';
import { ElementRef, Injectable, NgZone } from '@angular/core';
import * as earcut from 'earcut';
import {
  Engine,
  FollowCamera,
  UniversalCamera,
  Scene,
  Light,
  Mesh,
  MeshBuilder,
  AssetContainer,
  Color3,
  Color4,
  Tools,
  Vector3,
  HemisphericLight,
  StandardMaterial,
  Texture,
  DynamicTexture,
  NLerpBlock,
  ArcRotateCamera,
  Ray,
  ActionManager,
  ExecuteCodeAction,
  SceneLoader
} from 'babylonjs';
import 'babylonjs-materials';
import { CustomLoadingScreen } from './../loadingscreen'
//import * as config from './../../../package.json';

@Injectable({ providedIn: 'root' })
export class EngineService {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private freecamera: FollowCamera;
  private playercamera: UniversalCamera;
  private scene: Scene;
  private light: Light;
  private loadingScreen: CustomLoadingScreen;
  private cameratype: CameraType = CameraType.ThirdPerson;
  private gameVersion: string;
  private characterCamera: ArcRotateCamera;
  private pointerLocked: boolean = false;

  public constructor(
    private ngZone: NgZone,
    private windowRef: WindowRefService
  ) {
    this.gameVersion = "0.0.1"//config.version;
  }

  public async createScene(canvas: ElementRef<HTMLCanvasElement>): Promise<void> {
    // The first step is to get the reference of the canvas element from our HTML document
    this.canvas = canvas.nativeElement;
    // Then, load the Babylon 3D engine:
    this.engine = new Engine(this.canvas, true);

    this.loadingScreen = new CustomLoadingScreen(this.gameVersion);
    // replace the default loading screen
    this.engine.loadingScreen = this.loadingScreen;
    // show the loading screen
    this.engine.displayLoadingUI();

    this.scene = new Scene(this.engine);

    //The math and properties for creating the hex grid.
    let gridSize = 2;
    let hexLength = 1;
    let hexWidthDistance = Math.sqrt(3) * hexLength;
    let hexHeightDistance = (2 * hexLength);
    let rowlengthAddition = 0;

    var camera = new ArcRotateCamera("camera", Tools.ToRadians(90), Tools.ToRadians(45), 10, Vector3.Zero(), this.scene);

    camera.lowerRadiusLimit = 5;

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // create hex tile mesh asset container and add hex mesh to it
    const hexTileMeshContainer = new AssetContainer(this.scene);
    const shape = [ new Vector3(0, 0, 2), new Vector3(2, 0, 1), new Vector3(2, 0, -1), new Vector3(0, 0, -2), new Vector3(-2, 0, -1), new Vector3(-2, 0, 1) ];   
    let hexTileMesh = MeshBuilder.CreatePolygon("polygon", {shape:shape, sideOrientation: Mesh.DOUBLESIDE }, this.scene, earcut);
    hexTileMeshContainer.meshes.push(hexTileMesh);

    //create the hex grid
    this.createHexGrid(gridSize, hexWidthDistance, hexHeightDistance, rowlengthAddition, hexTileMeshContainer, camera, this.scene);

    // simple rotation along the y axis
    this.scene.registerAfterRender(() => {
        /*  this.blockone.rotate (
            new Vector3(0, 1, 0),
            0.02,
            BABYLON.Space.LOCAL
          );*/
    });

    this.light = new HemisphericLight('light1', new Vector3(0, 1, 0), this.scene);

    // Attach events to the document
    document.addEventListener("pointerlockchange", this.pointerlockchange, false);
    document.addEventListener("mspointerlockchange", this.pointerlockchange, false);
    document.addEventListener("mozpointerlockchange", this.pointerlockchange, false);
    document.addEventListener("webkitpointerlockchange", this.pointerlockchange, false);

    this.engine.hideLoadingUI();

    // handling of hex tile picking
    this.scene.onPointerDown = function (evt, pickResult) {

    };
  }

  public createHexGrid(gridSize, hexWidthDistance, hexHeightDistance, rowlengthAddition, hexTileMesh, camera, scene) {
    try{
      let gridStart = new Vector3((hexWidthDistance / 2) * (gridSize - 1), 0, (-hexHeightDistance * 0.75) * (gridSize - 1));
      for (let i = 0; i < (gridSize * 2) - 1; i++) {
        for (let y = 0; y < gridSize + rowlengthAddition; y++) {
          let hexTile = hexTileMesh.instantiateModelsToScene(name => i.toString() + "-" + y.toString() + "_" + name, false);
          let hexTileRoot = hexTile.rootNodes[0];
          hexTileRoot.name = "hexTile" + i + y;
          hexTileRoot.position.copyFrom(gridStart);
          hexTileRoot.position.x -= hexWidthDistance * y;
  
          let hexChildren = hexTileRoot.getDescendants();
          for (let k = 0; k < hexChildren.length; k++) {
            hexChildren[k].name = hexChildren[k].name.slice(9);
            if (hexChildren[k].name === "terrain") {
              hexChildren[k].visibility = 0;
            }
          }
  
          let hexTileAnimGroup = hexTile.animationGroups[0];
          hexTileAnimGroup.name = "AnimGroup" + hexTileRoot.name;
        };
  
        if (i >= gridSize - 1) {
          rowlengthAddition -= 1;
          gridStart.x -= hexWidthDistance / 2;
          gridStart.z += hexHeightDistance * 0.75;
        }
        else {
          rowlengthAddition += 1;
          gridStart.x += hexWidthDistance / 2;
          gridStart.z += hexHeightDistance * 0.75;
        }
      };
    } catch(e: any) {
      console.log(e);
    }
  }

  public handleMouseMove(event: MouseEvent) {
    // console.log(`Coords: ${event.clientX} X ${event.clientY}`);
  }

  public handleKeypress(event: KeyboardEvent) {
    // console.log(`Key: ${event.key}`);
  }

  public pointerlockchange() {
    const controlEnabled = document.pointerLockElement || null;//document.mozPointerLockElement || document.webkitPointerLockElement || document.msPointerLockElement || document.pointerLockElement || null;

    // If the user is already locked
    if (!controlEnabled) {
      //camera.detachControl(canvas);
      this.pointerLocked = false;
    } else {
      //camera.attachControl(canvas);
      this.pointerLocked = true;
    }
  };

  public animate(): void {
    // We have to run this outside angular zones,
    // because it could trigger heavy changeDetection cycles.
    this.ngZone.runOutsideAngular(() => {
      const rendererLoopCallback = () => {
        this.scene.render();
      };

      if (this.windowRef.document.readyState !== 'loading') {
        this.engine.runRenderLoop(rendererLoopCallback);
      } else {
        this.windowRef.window.addEventListener('DOMContentLoaded', () => {
          this.engine.runRenderLoop(rendererLoopCallback);
        });
      }

      this.windowRef.window.addEventListener('resize', () => {
        this.engine.resize();
      });
    });
  }
}

export enum CameraType {
  FirstPerson,
  ThirdPerson
}

export enum CollisionGroup {
  Uno = 1,
  Dos = 2,
  Tres = 4,
  Cuatro = 8,
  Cinco = 16,
  Seis = 32,
  Siete = 64
}