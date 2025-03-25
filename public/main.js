const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    input: {
        activePointers: 1
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: true
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    parent: 'game-container'
};

const socket = io();  // Connect to the server


const game = new Phaser.Game(config);
const canvas = document.getElementById("game-container");

let scene, cursors, currentAnim = ""
let objects = [], collide_objects = [], gui_objects = [];
// map
let background;
let mapWidth = 3200;
let mapHeight = 2400;

let darkness, spotlight, mask, lightbeam;

let combinedMaskGraphics, combinedMask;
let flashlight = false;
let flashlength = 250;
let change = false;
// player speed and animations
let player, players = {};
let lastVelocityState = { x: 0, y: 0 };
let defaultSpeed = 100, sprintSpeed = 150, speed = defaultSpeed;
let avatarIdle = { up: 0, right: 15, down: 4, left: 8 };
let lastAnim, playAnim = false;
// stamina
let staminaBar;
let staminaBarWidth = 200;
let maxStamina = 100, stamina = maxStamina;
let staminaRegenRate = 1; // 0.1
let staminaDrainRate = 0.075; // 0.75
let isRunning = false;
//inventory
let inventory = [];
let inventoryMenu;
let inventoryBg;
let inventoryItems;
let inventoryMeta = { isOpen : false};

let toolbar;
let toolbarItem;

let light = false;

// npcs
let npc, patrolPath, npcSpeed = 100;
let distanceToPlayer, npcChaseRange = 200;

function preload() {
    this.load.image('floor', 'assets/floor.webp');
    this.load.spritesheet('avatar', 'assets/dude-rm.png', { frameWidth: 102, frameHeight: 152.75 });
    this.load.image('table', 'assets/table.png');
    this.load.image('box', 'assets/box.png');
    this.load.image('stamina', 'assets/stamina.png');
    this.load.image('stamina-bar', 'assets/stamina-bar.png');
    this.load.image('apple', 'assets/apple2.png');
    this.load.image('inventory_bg', 'assets/inventory.png');
    this.load.image('itemframe', 'assets/itemframe2.png');
    this.load.image('fullscreen', 'assets/fullscreen.png');
}

function create() {
    // SCENE
    scene = this;
    background = this.add.tileSprite(400, 300, mapWidth, mapHeight, 'floor');
    background.setDepth(-10000);
    this.physics.world.setBounds();

    // PLAYER
    //player = this.physics.add.sprite(400, 300, 'avatar').setScale(0.75).setCollideWorldBounds(true);

    socket.on('currentPlayers', (serverPlayers) => {
        for (let id in serverPlayers) {
            if (id === socket.id) {
                // This is the current user
                player = this.physics.add.sprite(serverPlayers[id].x, serverPlayers[id].y, 'avatar');
                this.cameras.main.startFollow(player);
                player.setSize(player.width * 0.75, player.height * 0.3);
                player.setOffset(player.body.offset.x, player.body.offset.y + 20);
                player.setDepth(player.y);
            } else {
                // Other players
                players[id] = this.physics.add.sprite(serverPlayers[id].x, serverPlayers[id].y, 'avatar');
            }
        }
    });
    

    // Listen for new players
    socket.on('newPlayer', (data) => {
        players[data.id] = this.physics.add.sprite(data.x, data.y, 'avatar');
    });

    // Listen for player movement
    socket.on('playerMoved', (data) => {
        if (players[data.id]) {
            players[data.id].x = data.x;
            players[data.id].y = data.y;
        }
    });

    // Remove disconnected players
    socket.on('removePlayer', (id) => {
        if (players[id]) {
            players[id].destroy();
            delete players[id];
        }
    });

    this.cameras.main.startFollow(player);
    player.setSize(player.width * 0.75, player.height * 0.3);
    player.setOffset(player.body.offset.x, player.body.offset.y + 20);
    player.setDepth(player.y);

    createAnimations(this);

    // DARKNESS
    darkness = this.add.graphics();
    darkness.fillStyle(0x000000, 0.5);
    darkness.fillRect(-background.width / 2, -background.height / 2, mapWidth, mapHeight);
    darkness.setDepth(10000).setScrollFactor(0);

    // Create spotlight layer
    spotlight = this.add.graphics();
    spotlight.fillStyle(0x000000, 0);
    spotlight.fillCircle(player.x, player.y, player.height / 2 + 5);

    mask = spotlight.createGeometryMask();
    mask.invertAlpha = true;
    darkness.setMask(mask);


    lightbeam = this.add.graphics();
    lightbeam.fillStyle(0x000000, 0); // Transparent color for the triangle

    // Draw the triangle representing the light beam
    lightbeam.fillTriangle(
        0, -flashlength / 2,  // Top point
        flashlength, 0,       // Right point
        0, flashlength / 2    // Bottom point
    );

    /*
    combinedMaskGraphics = this.add.graphics();
    combinedMaskGraphics.fillStyle(0x000000, 0);
    combinedMaskGraphics.fillCircle(player.x, player.y, player.height / 2 + 5);
    */
    

    //this.cameras.main.setBounds(0, 0, 400, 300); // no follow player

    // FULLSCREEN
    let fullscreenIcon = this.add.image(config.width - 40, 40, 'fullscreen')
        .setInteractive()
        .setScrollFactor(0)
        .setDepth(10000)
        .setScale(0.5)
        .on('pointerdown', () => {
            if (!this.scale.isFullscreen) {
                this.scale.startFullscreen();
            } else {
                this.scale.stopFullscreen();
            }
        });

    // CONTROLS
    cursors = this.input.keyboard.createCursorKeys();
    this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    
    //HUD - GUI

        //Inventory Menu
        inventoryMenu = this.add.container(0, 0).setDepth(10000);
        inventoryMenu.setVisible(!inventoryMenu.visible);
        


        toolbarItem = this.add.image(this.scale.width / 2, this.scale.height - 50, 'itemframe').setScrollFactor(0).setScale(0.7).setDepth(10000);
        // Stamina Bar
        staminaBar = this.add.sprite(150, this.scale.gameSize.height, 'stamina')
        .setScrollFactor(0)
        .setDepth(10001)
        .setScale(0.5);
        this.staminaText = this.add.text(10, 10, 'Stamina: 100%', { fontSize: '16px', fill: '#fff' }).setScrollFactor(0).setDepth(10000);
        staminaBarBorder = this.add.sprite(150, config.height,'stamina-bar').setScrollFactor(0).setDepth(10001).setScale(0.5);
        

        gui_objects.push(inventoryMenu,toolbarItem,staminaBar,staminaBarBorder,this.staminaText);
        // Minimap  ---
        const minimapSize = 200;
        const minimapZoom = 0.8;
        const minimap = this.cameras.add(
            this.scale.width - minimapSize - 10,
            this.scale.height - minimapSize - 10,
            minimapSize,
            minimapSize
        );
        minimap.setZoom(minimapZoom / 5);
        minimap.startFollow(player);
        minimap.setBackgroundColor(0x000000);
        // Draw a frame around the minimap
        let graphics = this.add.graphics();
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.strokeRect(this.scale.gameSize.width - minimapSize - 10, this.scale.gameSize.height - minimapSize - 10, minimapSize, minimapSize).setScrollFactor(0).setDepth(10000);

        minimap.ignore(gui_objects);

    // OBJECTS
    addObject(this, 500, 500, 'table', 0.15);
    addObject(this, 600, 300, 'table', 0.15);

    addRandomObjects(this, 'apple', 15, 0.65, false, (obj) => {
        addToInventory(obj);
    });

    this.physics.add.collider(player, collide_objects);


}

function update() {
    move();

    if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
        loadInventory();
        openInventory();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyF)) {
        flashlight = !flashlight;
        /*
        if (flashlight) {
            if (change)
            combinedMaskGraphics.clear();
            combinedMaskGraphics = this.add.graphics();
    
            combinedMaskGraphics.fillStyle(0x000000, 0);
            combinedMaskGraphics.fillCircle(player.x, player.y, player.height / 2 + 5);
            
            combinedMaskGraphics.fillStyle(0xffffff, 0.3);
            combinedMaskGraphics.fillTriangle(
                player.x, player.y - flashlength / 2,  // Top point
                player.x + flashlength, player.y,     // Right point
                player.x, player.y + flashlength / 2  // Bottom point
            );
            change = true;
        } else if (change) {
            combinedMaskGraphics.clear();
            combinedMaskGraphics = this.add.graphics();
            // First, use the spotlight circle for the mask
            combinedMaskGraphics.fillStyle(0x000000, 0);
            combinedMaskGraphics.fillCircle(player.x, player.y, player.height / 2 + 5);
        }
        */

    }

    spotlight.x = player.x-400;
    spotlight.y = player.y-300;

    
}

function move() {
    let velocityX = 0, velocityY = 0;
    
    if (cursors.shift.isDown) {
        if (stamina > 1) {
            speed = sprintSpeed;
        } else {
            speed = defaultSpeed;
        }
        isRunning = true;
    } else if (cursors.shift.isUp) {
        speed = defaultSpeed;
        isRunning = false;
    }
    
    if (cursors.left.isDown || scene.keyA.isDown) {
        velocityX = -1 * speed;
        setAnimation('left');
    } else if (cursors.right.isDown || scene.keyD.isDown) {
        velocityX = speed;
        setAnimation('right');
    }

    if (cursors.up.isDown || scene.keyW.isDown) {
        velocityY = -1 * speed;
    } else if (cursors.down.isDown || scene.keyS.isDown) {
        velocityY = speed;
    }

    player.setVelocity(velocityX, velocityY);

    if (velocityX === 0 && velocityY === 0) {
        setAvatarIdle();
        player.anims.stop();
        currentAnim = "";
    } else if (!velocityX) {
        setAnimation(cursors.up.isDown || scene.keyW.isDown ? 'up' : 'down');
    }

    if (velocityY != lastVelocityState.y) {
        player.setDepth(player.y);
    }

    lastVelocityState = { x : velocityX, y : velocityY };

    // Stamina
    if (isRunning) {
        if (stamina > staminaDrainRate) {
            stamina -= staminaDrainRate;
        } else {
            isRunning = false;
        }
    } else {
        if (stamina < maxStamina) {
            stamina += staminaRegenRate;
        }
    }

    drawStaminaBar();
    scene.staminaText.setText(`Stamina: ${Math.floor(stamina)}%`);
}

function setAnimation(anim) {
    if (currentAnim !== anim) {
        player.play(anim);
        currentAnim = anim;
    }
}

function createAnimations(scene) {
    scene.anims.create({ key: 'left', frames: scene.anims.generateFrameNumbers('avatar', { start: 8, end: 11 }), frameRate: speed / 20, repeat: -1 });
    scene.anims.create({ key: 'right', frames: scene.anims.generateFrameNumbers('avatar', { start: 12, end: 15 }), frameRate: speed / 20, repeat: -1 });
    scene.anims.create({ key: 'up', frames: scene.anims.generateFrameNumbers('avatar', { start: 4, end: 7 }), frameRate: speed / 20, repeat: -1 });
    scene.anims.create({ key: 'down', frames: scene.anims.generateFrameNumbers('avatar', { start: 0, end: 3 }), frameRate: speed / 20, repeat: -1 });
}

function editAnimations() {
    scene.anims.remove('left');
    scene.anims.remove('right');
    scene.anims.remove('up');
    scene.anims.remove('down');

    scene.anims.create({ key: 'left', frames: scene.anims.generateFrameNumbers('avatar', { start: 8, end: 11 }), frameRate: speed / 20, repeat: -1 });
    scene.anims.create({ key: 'right', frames: scene.anims.generateFrameNumbers('avatar', { start: 12, end: 15 }), frameRate: speed / 20, repeat: -1 });
    scene.anims.create({ key: 'up', frames: scene.anims.generateFrameNumbers('avatar', { start: 4, end: 7 }), frameRate: speed / 20, repeat: -1 });
    scene.anims.create({ key: 'down', frames: scene.anims.generateFrameNumbers('avatar', { start: 0, end: 3 }), frameRate: speed / 20, repeat: -1 });
    
}

function addObject(scene, x, y, texture, scale = 1, collidable = true, onTouch = null) {
    let obj = scene.physics.add.staticImage(x, y, texture).setScale(scale);

    // Get original image dimensions and apply scaling
    let scaledWidth = obj.displayWidth;  // This returns the actual scaled width
    let scaledHeight = obj.displayHeight; // This returns the actual scaled height

    obj.body.setSize(scaledWidth, scaledHeight); // Set physics body to match scaled size

    // Correct the body position so it's centered properly
    obj.body.setOffset((obj.width - scaledWidth) / 2, (obj.height - scaledHeight) / 2);
    obj.setDepth(obj.y);

    objects.push(obj);

    if (collidable) {
        collide_objects.push(obj);
    }

    if (onTouch) {
        scene.physics.add.overlap(player, obj, () => onTouch(obj), null, scene);
    }

    return obj;
}

function addRandomObjects(scene, texture, quantity, scale = 1, collidable = true, onTouch = null) {
    let maxAttemptsPerObject = 100; // Limit to avoid infinite loops

    for (let i = 0; i < quantity; i++) {
        let attempts = maxAttemptsPerObject;
        let x, y, tooClose;

        do {
            x = Phaser.Math.Between(50, mapWidth / 2 - 50);
            y = Phaser.Math.Between(50, mapHeight / 2 - 50);
            tooClose = objects.some(obj => Phaser.Math.Distance.Between(x, y, obj.x, obj.y) < 100);
            
            attempts--;
            if (attempts <= 0) {
                console.log("quitting");
                break; 
            }
        } while (tooClose);

        if (!tooClose) {
            addObject(scene, x, y, texture, scale, collidable, onTouch);
        }
    }
}


function setAvatarIdle() {
    if (lastVelocityState.x != 0) {
        player.setFrame(lastVelocityState.x > 0 ? avatarIdle.right : avatarIdle.left);
    } else if (lastVelocityState.y != 0) {
        player.setFrame(lastVelocityState.y > 0 ? avatarIdle.up : avatarIdle.down);
    }
}

function drawStaminaBar() {
    staminaBar.setCrop(0, 0, staminaBar.width * (stamina / maxStamina), staminaBar.height);
}

// INVENTORY
function addToInventory(obj) {
    obj.destroy();
    inventory.push(obj);
    console.log("Player touched:", obj.texture.key);
    loadInventory();
}

function openInventory() {
    inventoryMenu.setVisible(!inventoryMenu.visible);
    inventory.forEach((element, index) => {
        console.log(element.texture.key);
    });
}

function loadInventory() {

    inventory.forEach((element, index) => {
        if (index == 0) {
            item = scene.add.image(toolbarItem.x, toolbarItem.y, element.texture.key).setInteractive().setScrollFactor(0).setDepth(10000);
            item.setInteractive().setScrollFactor(0);
            item.on('pointerdown', () => {
                use(index, item);
            });
        }
    });

    /*
    inventoryMenu.removeAll(true);
    
    inventoryBg = scene.add.image(400,300,'inventory_bg').setScrollFactor(0).setScale(1.4);
    inventoryMenu.add(inventoryBg);
    inventoryItems = scene.add.container(0, 0);
    inventoryMenu.add(inventoryItems);

    let marginLeft = 0;
    lastElement = {width : 0};
    console.log(inventory);
    inventory.forEach((element, index) => {
        marginLeft += lastElement.width + 17.5;
        item = scene.add.image((inventoryBg.x - inventoryBg.displayWidth / 2 + 56.5) + marginLeft, (inventoryBg.y - inventoryBg.height / 2) + 37, element.texture.key).setInteractive();
        inventoryMenu.add(item);
        item.setInteractive().setScrollFactor(0);
        item.on('pointerdown', () => {
            use(index, item);
        });
        lastElement = element;
    });
    */
}

// USE Items
function use(index, item) {
    if (item.texture.key == "apple") {
        if (stamina > 80) {
            stamina = 100;
        } else {
            stamina += 20;
        }

        item.destroy();
        inventory.splice(index, 1);
        loadInventory();
    }
}

