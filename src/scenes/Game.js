import { Player } from '../gameObjects/Player.js';
import { Guard } from '../gameObjects/Guard.js';

export class Game extends Phaser.Scene {
    constructor() {
        super('Game');
    }

    create() {
        // Spielstatus (wenn true → Spiel ist vorbei)
        this.gameOver = false;
        this.hazardTimer = null;

        // Weltgröße (wie groß die Map ist)
        this.physics.world.setBounds(0, 0, 3000, 600);

        // Hintergrund
        this.add.tileSprite(0, 0, 3000, 600, 'sky')
            .setOrigin(0, 0)
            .setScrollFactor(0);

        // Plattformen (statische Objekte)
        this.platforms = this.physics.add.staticGroup();

        // Boden erstellen
        for (let x = 0; x < 3000; x += 400) {
            this.platforms.create(x, 568, 'ground')
                .setScale(2)
                .refreshBody();
        }

        // zusätzliche Plattformen
        this.platforms.create(400, 400, 'ground');
        this.platforms.create(800, 300, 'ground');
        this.platforms.create(1200, 350, 'ground');
        this.platforms.create(1600, 250, 'ground');
        this.platforms.create(2000, 350, 'ground');
        this.platforms.create(2400, 300, 'ground');

        // Text-Stil für alle Anzeigen
        this.textStyle = {
            fontSize: '32px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            align: 'center'
        };

        // Spieler erstellen
        this.player = new Player(this, 100, 450);
        this.physics.add.collider(this.player, this.platforms);

        // Kamera folgt dem Spieler
        this.cameras.main.setBounds(0, 0, 3000, 600);
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

        // Tastatur-Eingabe
        this.cursors = this.input.keyboard.createCursorKeys();

        // Spieler Werte
        this.lives = 3;
        this.homework = 0;

        // Level-System (Phasen)
        this.phase = 1;
        this.requiredHomework = 5;

        // UI Text oben links
        this.uiText = this.add.text(16, 16, '', {
            fontSize: '20px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setScrollFactor(0);

        // Sammelobjekte (Hausaufgaben)
        this.homeworks = this.physics.add.group();

        // Kollision mit Plattformen
        this.physics.add.collider(this.homeworks, this.platforms);

        // Wenn Spieler Hausaufgabe berührt
        this.physics.add.overlap(this.player, this.homeworks, this.collectHomework, null, this);

        // Gegner Gruppe
        this.enemies = this.physics.add.group();

        // Fallende Objekte Gruppe
        this.fallingHazards = this.physics.add.group();

        // Kollisionen mit Welt
        this.physics.add.collider(this.enemies, this.platforms);
        this.physics.add.collider(this.fallingHazards, this.platforms);

        // Spieler trifft Gegner
        this.physics.add.collider(this.player, this.enemies, this.handleEnemyCollision, null, this);

        // Spieler trifft fallende Objekte
        this.physics.add.overlap(this.player, this.fallingHazards, (player, hazard) => {
            hazard.destroy();
            this.damagePlayer();
        });

        // erster NPC (Level Fortschritt)
        this.guard = new Guard(this, 900, 500, 'marilda');
        this.physics.add.overlap(this.player, this.guard, this.checkGuard, null, this);

        // Neustart Tasten
        this.input.keyboard.on('keydown-SPACE', () => this.scene.restart());
        this.input.keyboard.on('keydown-ENTER', () => this.scene.restart());

        // Start Level 1
        this.startPhase1();
        this.updateUI();

        // letzter NPC (Win Bedingung)
        this.karl = new Guard(this, 2700, 450, 'karl');
        this.karl.setVisible(false);
        this.karl.body.enable = false;

        this.physics.add.overlap(this.player, this.karl, () => {
            this.showMessage("Bravo Paul.\nDu hast alle Hausaufgaben gesammelt!");
            this.endGame(true);
        });
    }

    update() {
        if (this.gameOver) return;

        const speed = 200;

        // Bewegung nach links
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-speed);
            this.player.anims.play('left', true);
        }
        // Bewegung nach rechts
        else if (this.cursors.right.isDown) {
            this.player.setVelocityX(speed);
            this.player.anims.play('right', true);
        }
        // stehen bleiben
        else {
            this.player.setVelocityX(0);
            this.player.anims.play('turn');
        }

        // springen
        if (this.cursors.up.isDown) {
            this.player.jump();
        }
    }

    // Hausaufgaben spawnen
    spawnHomework(positions) {
        positions.forEach(pos => {
            const homework = this.homeworks.create(pos.x, pos.y, 'homework');
            homework.setBounce(0.3);
        });
    }

    // Hausaufgabe einsammeln
    collectHomework(player, homework) {
        homework.destroy();
        this.homework++;
        this.updateUI();
    }

    // Gegner erstellen
    spawnEnemy(x, y, texture) {
        const enemy = this.enemies.create(x, y, texture);

        enemy.setCollideWorldBounds(true);
        enemy.setBounce(1, 0);
        enemy.setVelocityX(80);

        return enemy;
    }

    // Schaden durch Gegner
    handleEnemyCollision(player, enemy) {
        this.damagePlayer();
    }

    // Leben verlieren
    damagePlayer() {
        this.lives--;

        this.player.setTint(0xff0000);

        this.time.delayedCall(200, () => {
            this.player.clearTint();
        });

        this.updateUI();

        if (this.lives <= 0) {
            this.endGame(false);
        }
    }

    // NPC Interaktion (Phasen System)
    checkGuard() {
        if (this.phase === 1) {
            if (this.homework >= this.requiredHomework) {
                this.nextPhase();
            } else {
                this.showMessage("NICHT GENUG HAUSAUFGABEN");
            }
        }
        else if (this.phase === 2) {
            if (this.homework >= this.requiredHomework) {
                this.nextPhase();
            } else {
                this.showMessage("SAMMLE ALLE HAUSAUFGABEN");
            }
        }
    }

    // nächste Phase starten
    nextPhase() {
        this.phase++;
        this.clearLevel();

        // Phase 2
        if (this.phase === 2) {
            this.requiredHomework = 5;
            this.homework = 0;

            this.guard.setTexture('sidita');
            this.guard.setPosition(1850, 500);

            this.startPhase2();
            this.spawnFallingHazards();

            this.showMessage("PART 2");
        }

        // Phase 3 (Ende / Karl)
        else if (this.phase === 3) {
            this.guard.setVisible(false);
            this.guard.body.enable = false;

            if (this.hazardTimer) {
                this.hazardTimer.remove();
                this.hazardTimer = null;
            }

            this.karl.setVisible(true);
            this.karl.body.enable = true;
            this.karl.setPosition(2700, 500);

            this.showMessage("Geh zu Karl");
        }

        this.updateUI();
    }

    // Level zurücksetzen
    clearLevel() {
        this.homeworks.clear(true, true);
        this.enemies.clear(true, true);
    }

    // Phase 1 Setup
    startPhase1() {
        this.spawnHomework([
            { x: 300, y: 200 },
            { x: 600, y: 200 },
            { x: 900, y: 200 },
            { x: 1200, y: 200 },
            { x: 1500, y: 200 }
        ]);

        const textures = [
            'ergit','eriseld','gani','eni','ajsi',
            'gesart','lea','tea','hera','sidrit',
            'ardita','ermi','erisa','glejdi','nedit'
        ];

        textures.forEach((texture, i) => {
            this.spawnEnemy(400 + i * 180, 0, texture);
        });
    }

    // Phase 2 Setup
    startPhase2() {
        this.spawnHomework([
            { x: 1600, y: 200 },
            { x: 1750, y: 220 },
            { x: 1900, y: 200 },
            { x: 2050, y: 220 },
            { x: 2200, y: 200 }
        ]);
    }

    // UI aktualisieren
    updateUI() {
        this.uiText.setText(
            `Hausaufgaben: ${this.homework}/${this.requiredHomework} | Leben: ${this.lives} | Phase: ${this.phase}`
        );
    }

    // Text anzeigen
    showMessage(text) {
        const msg = this.add.text(400, 200, text, this.textStyle)
            .setOrigin(0.5)
            .setScrollFactor(0);

        this.time.delayedCall(1500, () => msg.destroy());
    }

    // Game Over Screen
    endGame(win) {
        this.gameOver = true;
        this.physics.pause();

        const text = win ? 'DU HAST GEWONNEN' : 'DU HAST VERLOREN';

        this.time.delayedCall(10, () => {
            this.add.text(400, 300, text + "\nDrücke SPACE zum Neustart", this.textStyle)
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(999);
        });
    }

    // fallende Objekte
    spawnFallingHazards() {
        const textures = ['laptop', 'pultteiler', 'bag'];

        this.hazardTimer = this.time.addEvent({
            delay: 1800,
            loop: true,
            callback: () => {

                if (this.phase !== 2) return;

                const x = Phaser.Math.Between(1750, 1950);
                const texture = Phaser.Utils.Array.GetRandom(textures);

                const obj = this.fallingHazards.create(x, 0, texture);

                obj.setScale(1.2);
                obj.setAngularVelocity(150);
                obj.setVelocityY(120);

                this.time.delayedCall(2000, () => {
                    if (obj) obj.destroy();
                });
            }
        });
    }
}