class Player {
    constructor(x, y, scene, scale) {
        this.x = x;
        this.y = y;
        this.scene = scene;
        this.scale = scale;
    }

    draw() {
        const player = scene.physics.add.sprite(this.x, this.y, 'avatar').setScale(this.scale).setCollideWorldBounds(true);
        player.setSize(player.width * 0.75, player.height * 0.3);
        player.setOffset(player.body.offset.x, player.body.offset.y + 20);
        player.setDepth(player.y);
        player.setDrag(500);
        player.setMass(10);

        return player;
    }
}