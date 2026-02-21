import "./styles/main.scss";

const Phaser = (window as unknown as { Phaser: any }).Phaser;

class BounceScene extends Phaser.Scene {
  private ball?: any;
  private velocity = new Phaser.Math.Vector2(240, 320);

  create() {
    const { width, height } = this.scale;

    this.ball = this.add.circle(width * 0.5, height * 0.5, 22, 0xd6a64b);
    this.add
      .text(width * 0.5, 28, "Bouncing Ball", {
        fontFamily: "'Trebuchet MS', sans-serif",
        fontSize: "20px",
        color: "#f7f5f0",
      })
      .setOrigin(0.5);

    this.scale.on("resize", (gameSize: { width: number; height: number }) => {
      if (!this.ball) return;
      this.ball.x = Phaser.Math.Clamp(this.ball.x, 22, gameSize.width - 22);
      this.ball.y = Phaser.Math.Clamp(this.ball.y, 22, gameSize.height - 22);
    });
  }

  update(_, delta: number) {
    if (!this.ball) return;

    const dt = delta / 1000;
    this.ball.x += this.velocity.x * dt;
    this.ball.y += this.velocity.y * dt;

    const radius = this.ball.radius;
    const width = this.scale.width;
    const height = this.scale.height;

    if (this.ball.x <= radius && this.velocity.x < 0) {
      this.ball.x = radius;
      this.velocity.x *= -1;
    } else if (this.ball.x >= width - radius && this.velocity.x > 0) {
      this.ball.x = width - radius;
      this.velocity.x *= -1;
    }

    if (this.ball.y <= radius && this.velocity.y < 0) {
      this.ball.y = radius;
      this.velocity.y *= -1;
    } else if (this.ball.y >= height - radius && this.velocity.y > 0) {
      this.ball.y = height - radius;
      this.velocity.y *= -1;
    }
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#14130f",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 360,
    height: 640,
  },
  scene: [BounceScene],
};

new Phaser.Game(config);
