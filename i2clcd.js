module.exports = function (RED) {
    const i2c = require('i2c-bus');
    const sleep = require('sleep');
    let LCD = class LCD {
        constructor(device, address = 0x3F, cols, rows) {
            this.I2C_ADDRESS = address
            this.LCD_BACKLIGHT_ON = 0x08
            this.LCD_BACKLIGHT_OFF = 0x00

            this.buffer = new Buffer(3);  //Required for printlnBuffer.


            this.ENABLE = 0b00000100


            this.E_PULSE = 0.0005
            this.E_DELAY = 0.0005

            //sending command
            this.LCD_CMD = 0
            //sending data mode
            this.LCD_CHR = 1


            //Line addresses.
            this.LINEADDRESS = [0x80, 0xC0];

            this.device = device;
            this.backlight = true

            this.cols = cols;
            this.rows = rows;
            this.i2c = null

            this._init();
        }


        _init() {
            this.i2c = i2c.open(this.device, function (err) {
                if (err) {
                    console.log('Unable to open I2C port on device ' + device + ' ERROR: ' + err);
                    console.log(this);
                    return this
                }
            });
        }

        _sleep(milli) {
            sleep.usleep(milli * 1000);
        }

        setBacklight(toggle) {
            this.backlight = toggle
        }

        getBacklightValue() {
            return this.backlight ? this.LCD_BACKLIGHT_ON : this.LCD_BACKLIGHT_OFF
        }


        async lcdByte(bits, mode) {
            const bitsHigh = mode | (bits & 0xF0) | this.getBacklightValue();
            const bitsLow = mode | ((bits << 4) & 0xF0) | this.getBacklightValue();


            await this.i2c.writeQuick(this.I2C_ADDRESS, bitsHigh);
            await this.toggleEnable(bitsHigh)

            await this.i2c.writeQuick(this.I2C_ADDRESS, bitsLow);
            await this.toggleEnable(bitsLow)


        };

        async toggleEnable(bits) {
            this._sleep(this.E_DELAY);
            await this.i2c.writeQuick(this.I2C_ADDRESS, (bits | this.ENABLE));
            this._sleep(this.E_PULSE);
            await this.i2c.writeQuick(this.I2C_ADDRESS, (bits & ~this.ENABLE));
            this._sleep(this.E_DELAY);
        }

        async message(text,line=1){
            if(line > 2){
                line = 1
            }
            text = text.substr(0,this.cols)
            await this.lcdByte(line,this.LCD_CMD)
            for(let i = 0 ; i < this.cols ; i++){
                await this.lcdByte(text.charCodeAt(i),this.LCD_CHR)
            }
        }

        async clear() {
            await this.lcdByte(0x01,this.LCD_CMD)
        };

    }
    let lcd = null

    function I2Clcd(config) {
        console.log("Creating lcd node")
        RED.nodes.createNode(this, config);
        let node = this;
        this.LCD_ADDR = Number(config.addr);
        this.LCD_BUS = Number(config.bus);
        this.LCD_NUMCOLS = Number(config.numcols);
        this.LCD_NUMROWS = Number(config.numrows);
        console.log("LCD node init @ i2c addr:" + this.LCD_ADDR);
        lcd = new LCD(this.LCD_BUS, this.LCD_ADDR, this.LCD_NUMCOLS, this.LCD_NUMROWS);
        node.on('input', function (msg) {
            console.log("LCD input " + msg.topic);
            if (msg.topic.localeCompare("init") === 0) {
                lcd._init();
            }

            if (msg.topic.localeCompare("clear") === 0) {
                lcd.clear();
            }

            if (msg.topic.localeCompare("line1") === 0) {
                lcd.message(msg.payload, 1);
            }

            if (msg.topic.localeCompare("line2") === 0) {
                lcd.message(msg.payload, 2);
            }


            node.send(msg); //pass message through
        });

    }

    RED.nodes.registerType("i2clcd", I2Clcd);

}
