

var LoopGame = (function() {
    'use strict';

    /**********
     * config */
    var DIMS = [752, 423]; //canvas dimensions
    var BALL_RAD = 7.77;
    var BOARD_COLOR = 'green';
    var BORDER_COLOR = '#AD8334';
    var BORDER_THICKNESS = 20; //the "wooden" border size
    var MAX_ARROW_LEN = 112; //max length of an aiming arrow
    var VEL_CONST = 1/15; //velocity constant, smaller -> higher max speeds
    var ECCENTRICITY = 0.43;
    var USE_TEXTURES = true;

    /*************
     * constants */
    var CENTER = [DIMS[0]/2, DIMS[1]/2]; //canvas center
    var MIN_AXIS = CENTER[1] - 25; //minor axis of the board
    var FOCUS_LEN = MIN_AXIS/Math.sqrt(Math.pow(ECCENTRICITY, -2)-1);
    var MAJ_AXIS = Math.sqrt(MIN_AXIS*MIN_AXIS + FOCUS_LEN*FOCUS_LEN);
    var FOCUS1 = [-FOCUS_LEN, 0];
    var FOCUS2 = [FOCUS_LEN, 0];
    var PHI = 0.5+0.5*Math.sqrt(5);
    var EPS = Math.pow(10, -1.5); //speeds below this value are rounded to zero
    var FRICTION = [
        100, //larger this is, the longer balls roll for
        1/(1 - 0.98) //the decimal is the lowest friction value
    ];
    var FOOTER_COLS = ['#343536', '#2A2A2A', '#232323', '#121212'];

    /*********************
     * working variables */
    var canvas, ctx;
    var balls, playerColors, turn, advanceTurn, pocketedOppsBall;
    var moveIsOngoing, gameIsOngoing;
    var currentlyAiming, mouseDownLoc, currMouseLoc;
    var woodTexture, clothTexture;

    /******************
     * work functions */
    function initLoopGame() {
        //working variables
        canvas = $s('#canvas');
        $s('#orange-option').style.display = 'none';
        $s('#black-option').style.display = 'none';
        canvas.width = DIMS[0];
        canvas.height = DIMS[1];
        ctx = canvas.getContext('2d');

        //make the canvas adapt to the window size
        $s('#canvas-container').style.height = DIMS[1]+'px';
        Crush.registerDynamicCanvas(canvas, function(dims) {
            //adjust this so you can see the border radius of the shard
            dims[0] -= 6;
            canvas.width = dims[0];

            //recalculate all of the ellipse's variables
            DIMS = dims.slice(0);
            CENTER = [DIMS[0]/2, DIMS[1]/2]; //canvas center
            MIN_AXIS = CENTER[1] - 25; //minor axis of the board
            FOCUS_LEN = MIN_AXIS/Math.sqrt(Math.pow(ECCENTRICITY, -2)-1);
            MAJ_AXIS = Math.sqrt(MIN_AXIS*MIN_AXIS + FOCUS_LEN*FOCUS_LEN);
            FOCUS1 = [-FOCUS_LEN, 0];
            FOCUS2 = [FOCUS_LEN, 0];
        });

        //analytics
        if (window.location.protocol.indexOf('http') === 0) {
            (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
            m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
            })(window,document,'script','//www.google-analytics.com/analytics.js','ga');
            ga('create', 'UA-47072440-9', 'auto');
            ga('send', 'pageview');
        }

        //get the textures
        woodTexture = false, clothTexture = false;
        if (USE_TEXTURES) {
            var textures = ['wood_texture.png', 'cloth_texture.png'];
            var img0 = document.createElement('img');
            img0.style.display = 'none';
            img0.onload = function() {
                woodTexture = ctx.createPattern(this, 'repeat');
            };
            img0.src = 'images/'+textures[0];
            document.body.appendChild(img0);

            clothTexture = false
            var img1 = document.createElement('img');
            img1.style.display = 'none';
            img1.onload = function() {
                clothTexture = ctx.createPattern(this, 'repeat');
            };
            img1.src = 'images/'+textures[1];
            document.body.appendChild(img1);
        }

        //initialize the balls
        initState();

        //misc variables todo with clicking
        currentlyAiming = false;
mouseDownLoc = [];
currMouseLoc = [];

// Event listeners
$s('#restart-btn').addEventListener('click', function (e) {
    e.preventDefault();
    initState();
}, false);

$s('#red-option').addEventListener('click', function (e) {
    e.preventDefault();
    if (playerColors[0] === false) {
        playerColors = [3, 2]; // 3 é vermelho
        updateInstructions();
    }
}, false);

canvas.addEventListener('mousedown', startAiming, false);
canvas.addEventListener('mousemove', trackMouse, false);
canvas.addEventListener('mouseup', shootIfAiming, false);
canvas.addEventListener('touchstart', startAiming, false);
canvas.addEventListener('touchmove', trackTouch, false);
canvas.addEventListener('touchend', shootIfAiming, false);
canvas.addEventListener('mouseout', cancelAiming, false);

function startAiming(e) {
    e.preventDefault();
    if (e.touches) {
        if (balls[0].getDistFrom([
            currMouseLoc[0] - CENTER[0],
            currMouseLoc[1] - CENTER[1]
        ]) < PHI * balls[0].r) {
            currentlyAiming = true;
            mouseDownLoc = getTouchPos(e);
        }
    } else {
        if (balls[0].getDistFrom([
            currMouseLoc[0] - CENTER[0],
            currMouseLoc[1] - CENTER[1]
        ]) < PHI * balls[0].r) {
            currentlyAiming = true;
            mouseDownLoc = getMousePos(e);
        }
    }
}

function trackMouse(e) {
    e.preventDefault();
    currMouseLoc = getMousePos(e);
}

function trackTouch(e) {
    e.preventDefault();
    currMouseLoc = getTouchPos(e);
}

function shootIfAiming(e) {
    e.preventDefault();
    if (currentlyAiming) {
        currentlyAiming = false;
        if (playerColors[0] !== false && !moveIsOngoing) {
            moveIsOngoing = true;
            var tentNewVel = [
                (currMouseLoc[0] - balls[0].pos[0] - CENTER[0]),
                (currMouseLoc[1] - balls[0].pos[1] - CENTER[1])
            ];
            if (Math.sqrt(Math.pow(tentNewVel[0], 2) +
                Math.pow(tentNewVel[1], 2)) > MAX_ARROW_LEN) {
                tentNewVel = scalarTimes(
                    MAX_ARROW_LEN, normalize(tentNewVel)
                );
            }
            var newVel = scalarTimes(VEL_CONST, tentNewVel);
            balls[0].vel = newVel;

            if (window.location.protocol.indexOf('http') === 0) {
                ga('send', 'event', 'game', 'shoot');
            }
        } else if (playerColors[0] === false) {
            // Eles estão tentando mover, mas não selecionaram uma cor
            $s('#command').innerHTML = '<strong style="color: red">' +
                $s('#command').innerHTML +
                '</strong>';
        }
    }
}

function cancelAiming() {
    currentlyAiming = false;
}

function getTouchPos(e) {
    var rect = canvas.getBoundingClientRect();
    var touch = e.touches[0];
    return [
        touch.clientX - rect.left,
        touch.clientY - rect.top
    ];
}


        //draw the board
        requestAnimationFrame(render);
    }

    function updateInstructions(madeOpponentsBall) {
        var colors = [false,  'orange', 'red'];
        function showAllColors() {
            for (var ai = 1; ai < colors.length; ai++) {
                $s('#'+colors[ai]+'-option').style.display = 'inline';
            }
        }
        function hideAllColors() {
            for (var ai = 1; ai < colors.length; ai++) {
                $s('#'+colors[ai]+'-option').style.display = 'none';
            }
        }

        if (playerColors[0] === false) { //game just started
            $s('#command').innerHTML = 'Clique aqui para começar:';
            showAllColors();
            $s('#'+colors[1]+'-option').style.display = 'none';
        } else if (playerColors[0] === Infinity) { //player 1 wins
            $s('#command').innerHTML = '<strong style="color: red">'+
                'Clique em recomeçar para jogar de novo.';
            hideAllColors();
        } else if (playerColors[1] === Infinity) { //player 2 wins
            $s('#command').innerHTML = '<strong style="color: red">'+
                'Clique em recomeçar para jogar de novo.';
            hideAllColors();
        } else if (madeOpponentsBall === true) {
            $s('#command').innerHTML = '<strong style="color: red">Player '+
                (turn+1)+', you pocketed your opponent\'s ball!</strong>';
            hideAllColors();
        } else {
            //game ongoing
            $s('#command').innerHTML = '';
            hideAllColors();  
            $s('#'+colors[playerColors[turn]]+'-option')
                
        }
    }

    function initState() {
        if (typeof balls === 'object') goCrazy(12, 80);

        balls = [
            new BilliardBall(FOCUS1, 1, 'white'),
        ];

        playerColors = [false, false];
        turn = 0, advanceTurn = true, pocketedOppsBall = false;
        moveIsOngoing = false, gameIsOngoing = true;

        updateInstructions();
    }

    function goCrazy(n, delay) {
        var FooterColorChanger = new AsyncTrain(function(idx) {
            if (idx === n) return false;
            else if (idx === n-1) {
                for (var ai = 1; ai <= FOOTER_COLS.length; ai++) {
                    $s('#bar-'+ai).style.background = FOOTER_COLS[ai-1];
                }
                return true;
            } else {
                var colors = FOOTER_COLS.slice(0);
                for (var ai = 1; ai <= FOOTER_COLS.length; ai++) {
                    var colorIdx = (FOOTER_COLS.length+idx-ai)%FOOTER_COLS.length;
                    var color = FOOTER_COLS[colorIdx];
                    $s('#bar-'+ai).style.background = color;
                }
                return true;
            }
        }, function() { return delay; });
        FooterColorChanger.run();
    }

    function render() {
        //draw the table
        Crush.clear(ctx, '#FFFFFF');
        drawLoopTable();

        //cursor pointer
        if (balls[0].getDistFrom([
            currMouseLoc[0] - CENTER[0],
            currMouseLoc[1] - CENTER[1]
        ]) < PHI*balls[0].r && balls[0].depth !== -Infinity) {
            canvas.style.cursor = 'pointer';
        } else {
            canvas.style.cursor = 'inherit';
        }

        //draw the arrow
        if (currentlyAiming && balls[0].depth !== -Infinity) {
            var start = [
                balls[0].pos[0] + CENTER[0],
                balls[0].pos[1] + CENTER[1]
            ];
            var diff = vecSub(currMouseLoc, start);
            if (Math.sqrt(Math.pow(diff[0], 2)+
                Math.pow(diff[1], 2)) > MAX_ARROW_LEN) {
                diff = scalarTimes(
                    MAX_ARROW_LEN, normalize(diff)
                );
            }
            Crush.drawArrow(ctx, start, vecAdd(start, diff), '#EBEBCC');
        }

        //draw all the balls
        balls.map(function(ball) {
            if (ball.depth === -Infinity) return; //ignore pocketed balls

            Crush.drawPoint(
                ctx, vecAdd(ball.pos, CENTER),
                BALL_RAD, ball.color
            );
        });

        //update their positions and check for wall collisions
        balls.map(function(ball, ballIdx) {
            if (ball.depth === -Infinity) return; //ignore pocketed balls

            //appy velocity
            ball.move();

            //bound
            var distToWall = ball.getDistToWall();
            var distToCenter = -1;
            var wallCollision = false;
            if (distToWall < ball.r) {
                distToCenter = ball.getDistFromCenter();
                var change = distToCenter + distToWall - ball.r;
                change /= distToCenter;
                ball.pos = [change*ball.pos[0], change*ball.pos[1]];
                wallCollision = true;
            }

            //collide with the wall
            if (wallCollision) {
                var k = distToCenter + distToWall;
                k /= ball.getDistFromCenter();
                var collPt = [k*ball.pos[0], k*ball.pos[1]]; //collision point
                var x = collPt[0], y = collPt[1]; //ugh destructured asmts pls
                var dydx = -x*Math.pow(MIN_AXIS, 2);
                dydx /= y*Math.pow(MAJ_AXIS, 2);
                var normVec = normalize([1, -1/dydx]);
                var newVel = vecSub(ball.vel, scalarTimes(
                    2*dot(ball.vel, normVec),
                    normVec
                ));

                ball.vel = newVel;
            }
        });

        //collisions with other balls
        for (var bi = 0; bi < balls.length; bi++) {
            if (balls[bi].depth === -Infinity) continue;
            for (var li = bi+1; li < balls.length; li++) {
                if (balls[li].depth === -Infinity) continue;
                if (balls[bi].isHitting(balls[li])) {
                    balls[bi].collideWith(balls[li]);
                }
            }
        }

        //inside the pocket
        balls.map(function(ball, ballIdx) {
            if (ball.depth === -Infinity) return; //ignore pocketed balls

            if (ball.isInPocket()) {
                ball.depth -= 1/12;
                var perpVec = normalize([
                    ball.pos[0] - FOCUS2[0],
                    ball.pos[1] - FOCUS2[1]
                ]);
                if (ball.depth > -1) {
                    ball.vel = scalarTimes(
                        0.88, vecSub(ball.vel, scalarTimes(0.15, perpVec))
                    );
                } else {
                    ball.vel = scalarTimes(
                        0.7, vecSub(ball.vel, scalarTimes(0.6, perpVec))
                    );
                    var velMag = Math.sqrt(
                        ball.vel[0]*ball.vel[0] + ball.vel[1]*ball.vel[1]
                    );
                    if (ball.getDistFrom(FOCUS2) < 0.1 || velMag < 0.1) {
                        ball.fall();
                        goCrazy(15, 40);

                        if (gameIsOngoing) {
                            if (playerColors[turn] === ball.type) { //good
                                if (playerColors[turn] === 1) {
                                    //made the black in at the correct time
                                    playerColors[turn] = Infinity; //they win!
                                    gameIsOngoing = false;
                                } else {
                                    //made their color in at the correct time
                                    playerColors[turn] = 1;
                                }
                                updateInstructions(pocketedOppsBall);

                                //so it'll still be their turn
                                advanceTurn = pocketedOppsBall;
                            } else { //uh oh
                                if (ball.type === 0 || ball.type === 1) {
                                    //they made black or white ->
                                    playerColors[1-turn] = Infinity; //opp wins
                                    gameIsOngoing = false;
                                    updateInstructions(pocketedOppsBall);
                                } else {
                                    //they made their opponent's colored ball
                                    playerColors[1-turn] = 1; //opp on black
                                    advanceTurn = true;
                                    pocketedOppsBall = true;
                                    updateInstructions(pocketedOppsBall);
                                }
                            }
                        }
                    }
                }
            } else {
                ball.depth = 0;
            }
        });

        //simulate friction
        var movementStopped = true;
        balls.map(function(ball, ballIdx) {
            if (ball.depth === -Infinity) return; //ignore pocketed balls

            var speed = Math.sqrt(
                Math.pow(ball.vel[0], 2) + Math.pow(ball.vel[1], 2)
            );
            if (speed < EPS) {
                ball.vel = [0, 0];
            } else {
                movementStopped = false;
                var f = 1 - 1/(FRICTION[0]*speed + FRICTION[1]);
                ball.vel = [f*ball.vel[0], f*ball.vel[1]];
            }
        });

        //check to see if a turn ended
        if (movementStopped && moveIsOngoing) {
            moveIsOngoing = false;
            if (gameIsOngoing) {
                if (advanceTurn) turn = 1 - turn;
                else advanceTurn = true;
                pocketedOppsBall = false; //it's a new move
                updateInstructions(pocketedOppsBall);
            }
        }

        requestAnimationFrame(render);
    }

    function drawLoopTable() {
        //draw the elliptical shape
        Crush.fillEllipse(
            ctx, CENTER, FOCUS_LEN,
            MAJ_AXIS+BORDER_THICKNESS/2, BORDER_THICKNESS,
            clothTexture || BOARD_COLOR, 0,
            woodTexture || BORDER_COLOR
        );

        //highlight the focus points
        Crush.drawPoint(ctx, [
            FOCUS1[0]+CENTER[0], FOCUS1[1]+CENTER[1]
        ], 3, 'cyan');
        Crush.drawPoint(ctx, [
            FOCUS2[0]+CENTER[0], FOCUS2[1]+CENTER[1]
        ], BALL_RAD+2*PHI, '#EB1547');
        Crush.drawPoint(ctx, [
            FOCUS2[0]+CENTER[0], FOCUS2[1]+CENTER[1]
        ], BALL_RAD+PHI, '#730000');
    }

    /***********
     * objects */
    function BilliardBall(pos, type, color) {
        this.pos = pos;
        this.depth = 0;
        this.type = type;
        this.color = color;
        this.r = BALL_RAD; //don't let this vary, this game isn't that complex
        this.vel = [0, 0]; //no velocity

        this.move = function() {
            this.pos = [
                this.pos[0] + this.vel[0],
                this.pos[1] + this.vel[1]
            ];
        };
        this.fall = function() {
            this.vel = [0, 0];
            this.depth = -Infinity;

            if (window.location.protocol.indexOf('http') === 0) {
                ga('send', 'event', 'game', 'pocket');
            }
        };
        this.getDistFrom = function(pt) {
            return Math.sqrt(
                Math.pow(this.pos[0] - pt[0], 2) +
                Math.pow(this.pos[1] - pt[1], 2)
            );
        };
        this.getDistFromCenter = function() {
            //returns the distance from this ball to the center of the table
            return this.getDistFrom([0, 0]);
        };
        this.getDistToWall = function(afafs) {
            //returns the distance from the ball to the side of the loop table
            //in the direction of the center of the table through the ball
            var theta = Math.atan2(this.pos[1], this.pos[0]+FOCUS_LEN);
            var rad_ = MAJ_AXIS*(1 - Math.pow(ECCENTRICITY, 2));
            rad_ /= 1 - ECCENTRICITY*Math.cos(theta);
            var x = rad_*Math.cos(theta) - FOCUS_LEN;
            var y = rad_*Math.sin(theta);
            return Math.sqrt(x*x + y*y) - this.getDistFromCenter();
        };
        this.isHitting = function(b) {
            return this.getDistFrom(b.pos) < 2*BALL_RAD;
        };
        this.isInPocket = function() {
            return this.getDistFrom(FOCUS2) < BALL_RAD+2*PHI;
        }
        this.collideWith = function(b) {
            //get the velocity in terms of tangential and normal components
            var normSlope = (this.pos[1]-b.pos[1])/(this.pos[0]-b.pos[0]);
            var perpVec = normalize([1, normSlope]);
            var parallelVec = normalize([-normSlope, 1]);

            //new velocities are projections of the relative velocity on the
            //tangent/normal vectors
            var newVel1 = vecAdd(
                b.vel,
                scalarTimes(
                    dot(parallelVec, vecSub(this.vel, b.vel)),
                    parallelVec
                )
            );
            var newVel2 = vecAdd(
                b.vel,
                scalarTimes(
                    dot(perpVec, vecSub(this.vel, b.vel)),
                    perpVec
                )
            );
            this.vel = newVel1;
            b.vel = newVel2;

            //they collided, so they're overlapping. undo that and move more
            var overlap = 2*BALL_RAD - Math.sqrt(
                Math.pow(this.pos[0] - b.pos[0], 2) +
                Math.pow(this.pos[1] - b.pos[1], 2)
            );
            var offsetVec = scalarTimes(overlap/2, parallelVec);
            this.pos = vecAdd(this.pos, offsetVec);
            b.pos = vecSub(b.pos, offsetVec);
            this.move();
            b.move();
        };
    }

    function AsyncTrain(chooChoo, getNextDelay) {
        var self = this;
        this.timer = null;
        this.isPaused = false;
        this.delayFunc = getNextDelay;
        this.count = 0;
        this.run = function() {
            var keepGoing = chooChoo(this.count);
            this.count++;
            if (keepGoing) {
                this.timer = setTimeout(function() {
                    self.run();
                }, this.delayFunc());
            } else {
                //stop
            }
        };
        this.pause = function() {
            //pause here
            this.isPaused = !this.isPaused;
            if (this.isPaused) { //they're pausing
                clearTimeout(this.timer);
            } else { //they're unpausing
                this.timer = setTimeout(function() {
                    self.run();
                }, this.delayFunc());
            }
        };
        this.setDelayFunc = function(func) {
            this.delayFunc = func;
        };
    }

    /********************
     * helper functions */
    function getMousePos(e) {
        var rect = canvas.getBoundingClientRect();
        return [e.clientX-rect.left, e.clientY-rect.top];
    }
    function scalarTimes(s, a) {
        return a.map(function(comp) {
            return s*comp;
        });
    }
    function vecAdd(a, b) {
        return a.map(function(comp, idx) {
            return comp + b[idx];
        });
    }
    function vecSub(a, b) {
        return a.map(function(comp, idx) {
            return comp - b[idx];
        });
    }
    function normalize(vec) {
        var mag = Math.sqrt(vec.reduce(function(acc, comp) {
            return acc + comp*comp;
        }, 0));
        return vec.map(function(comp) {
            return comp/mag;
        });
    }
    function dot(a, b) {
        return a.reduce(function(acc, el, idx) {
            return acc + el*b[idx];
        }, 0);
    }
    function $s(id) { //for convenience
        if (id.charAt(0) !== '#') return false;
        return document.getElementById(id.substring(1));
    }

    return {
        init: initLoopGame
    };
})();

window.addEventListener('load', LoopGame.init);