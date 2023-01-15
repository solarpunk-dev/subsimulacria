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
import { defineHex, Grid, Hex, Orientation, HexSettings, spiral } from 'honeycomb-grid';
import { CustomLoadingScreen } from './../loadingscreen'
import { ISubBiome } from './../entities/sub-biome'
import { IGeography } from '../entities/geography';
import { Geography } from '../entities/geography-type';
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

    var camera = new ArcRotateCamera("camera", Tools.ToRadians(90), Tools.ToRadians(45), 10, Vector3.Zero(), this.scene);

    camera.lowerRadiusLimit = 5;

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    //create the hex grid
    this.createHexGrid(this.scene);

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

  public createHexGrid(scene) {
    try
    {
      let geographies: IGeography[] = this.createGeographies(scene);
      const hexTileMeshContainer = new AssetContainer(scene);

      const grid = this.createGrid(); 

      let hexTemplate = grid.getHex([0, 0]);
      if(hexTemplate == null){
        throw('no hexes');
      };

      let hexTileMesh = this.createHexTileMesh(scene, hexTemplate);

      let hexIndex = -1;
      
      grid.forEach(hex => {
        hexIndex++;

        let geography = this.calculateGeography(geographies, hex);

        hex.data = this.calculateSubBiome(grid, geography, hex);

        this.createHexTerrain(hexTileMesh, hexTileMeshContainer, hex, geography, hex.data );
      });

    } catch(e: any) {
      console.log("error: " + e);
    }
  }

  public createHexTileMesh(scene, hex: Hex)
  {
    const shape = [ new Vector3(hex.corners[0].x, 0, hex.corners[0].y), new Vector3(hex.corners[1].x, 0, hex.corners[1].y), new Vector3(hex.corners[2].x, 0, hex.corners[2].y), new Vector3(hex.corners[3].x, 0, hex.corners[3].y), new Vector3(hex.corners[4].x, 0, hex.corners[4].y), new Vector3(hex.corners[5].x, 0, hex.corners[5].y) ];   
    
    return MeshBuilder.CreatePolygon("hex", {shape: shape, sideOrientation: Mesh.DOUBLESIDE }, scene, earcut);
  }

  public createGrid(){
    //The math and properties for creating the hex grid.
    let gridSize = 5;
    let gridDimensions = 30;

    const defaultHexSettings: HexSettings = {
      dimensions: { xRadius: gridDimensions, yRadius: gridDimensions }, // these make for tiny hexes
      orientation: Orientation.FLAT, // flat top
      origin: { x: 0, y: 0 }, // the center of the hex
      offset: -1 // how rows or columns of hexes are placed relative to each other
    }

    let tile = defineHex(defaultHexSettings);

    return new Grid(tile, spiral({ start: [0, 0], radius:  gridSize}));
  }

  public calculateGeography(geographies: IGeography[], hex: Hex){
    if(hex.center.x == 0 && hex.center.y ==0 )
    {
      let centerGeographyIndex = geographies.findIndex(g => g.name == 'flatland');
      if(centerGeographyIndex < 0)
      {
        throw('no geography');
      }

      return geographies[centerGeographyIndex];
    }

    let thisGeographyIndex = Math.floor(Math.random() * geographies.length);
    return geographies[thisGeographyIndex];
  }

  public createHexTerrain(hexTileMesh: Mesh, hexTileMeshContainer: AssetContainer, hex: Hex, geography: IGeography, subBiome: ISubBiome){
    hexTileMeshContainer.meshes.splice(0);
    hexTileMesh.material = geography.material;
    hexTileMeshContainer.meshes.push(hexTileMesh);
    
    let hexTile = hexTileMeshContainer.instantiateModelsToScene(name => hex.q.toString() + "-" + hex.r.toString() + "_" + name, false );
    let hexTileRoot = hexTile.rootNodes[0];
    hexTileRoot.name = "hexTile" + hex.q + hex.r;
    hexTileRoot.position.x = hex.x;
    hexTileRoot.position.z = hex.y;

    let hexChildren = hexTileRoot.getDescendants();
    for (let k = 0; k < hexChildren.length; k++) {
      hexChildren[k].name = hexChildren[k].name.slice(9);
    }
  }

  public createGeographies(scene){
    let geographies: IGeography[] = [];

    let geographyData: Geography[] = ['flatland', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

    for(let i = 0; i < geographyData.length; i++){
      let redRandom = Math.round(Math.random()*100);
      let greenRandom =  Math.round(Math.random()*100);
      let blueRandom =  Math.round(Math.random()*100);

      let red = redRandom < 50 ? redRandom + 50 : redRandom;
      let green = greenRandom < 50 ? greenRandom + 50 : greenRandom;
      let blue = blueRandom < 50 ? blueRandom + 50 : blueRandom;

      if((red + green + blue) > 115){
        let randomColor = Math.random();
        if(randomColor < 0.34){
          red -= 30;
        }else if(randomColor > 0.66){
          green -= 30;
        }else{
          blue -= 30;
        }
      }

      let thisMaterial = new StandardMaterial("m_" + red.toString() + "-" + green.toString() + "-" + blue.toString(), scene);
      thisMaterial.emissiveColor = new Color3(red / 100, green / 100, blue / 100);
      thisMaterial.ambientColor = thisMaterial.emissiveColor;
      thisMaterial.diffuseColor = thisMaterial.emissiveColor;
      thisMaterial.specularColor = thisMaterial.emissiveColor;

      let thisGeography: IGeography = { material : thisMaterial, name : geographyData[i]};

      geographies.push(thisGeography);
    };

    return geographies;
  }

  public calculateSubBiome(grid: Grid<Hex>, geography :IGeography, hex: Hex){
    let climateId = "savanna";
    let biomeId = "tropical-savanna";
    let subBiomeId = "tree-savanna"

    console.log(hex);

    let subBiome: ISubBiome = {
      biomeId: biomeId,
      climateId: climateId,
      subBiomeId: subBiomeId,
      dimension: 1
    };
    
    return subBiome;
  }

  public handleMouseMove(event: MouseEvent) {
   //  console.log(`Coords: ${event.clientX} X ${event.clientY}`);
  }

  public handleKeypress(event: KeyboardEvent) {
     console.log(`Key: ${event.key}`);
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