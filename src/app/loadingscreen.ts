import {
  ILoadingScreen
} from 'babylonjs';

export class CustomLoadingScreen implements ILoadingScreen {

  //optional, but needed due to interface definitions
  public loadingUIBackgroundColor: string
  private minimumDelay: number = 5; // seconds
  private showTime: Date;

  constructor(public loadingUIText: string) {}

  public displayLoadingUI() {
    this.showTime = new Date();
    const splashversion = <HTMLElement>document.querySelector('#splashversion');
    splashversion.innerHTML = this.loadingUIText;
  }

  public hideLoadingUI() {
    let now = new Date();
    const diffTime = this.dateDiffMs(now, this.showTime);
    console.log(diffTime);
    const minimumDelayMs = this.minimumDelay * 1000;
    if(diffTime < minimumDelayMs)
    {
      setTimeout(()=>{ this.hideSplash(); }, (minimumDelayMs - diffTime));
      return;
    }
    this.hideSplash();
  }
  
  private dateDiffMs(dateOne, dateTwo):number {
    const utc1 = dateOne.getTime();
    const utc2 = dateTwo.getTime();
    return Math.floor(utc1 - utc2);
  }

  private hideSplash(){
    const splash = <HTMLElement>document.querySelector('#splash');
    splash.style.display = 'none';
  }
}