class DragornRender
{
    constructor(opt={})
    {
        this.initLib(opt);
        this.store.playing = true;

        // Front-end API
        this.store.API =
            {
                playing:        this.store.playing,
                canvas:         this.store.canvas,
                width:          this.store.resolution[0],
                height:         this.store.resolution[1],
                fps_cap:        this.store.fps_cap,
                fps:            this.store.fps,
                hz:             this.store.hz,

                addObj:         (obj)=>          { return this.addObj(obj) },
                rmvObj:         (obj)=>          { return this.rmvObj(obj) },
                findObj:        (ref)=>          { return this.findObj(ref) },
                addLyr:         (n, opt={})=>    { return this.addLyr(n, opt) },
                addImage:       (src, base="")=> { return this.addImage(src, base) },
                addRenderpass:  (n, opt={})=>    { return this.addRenderpass(n, opt) },
                rmvRenderpass:  (n)=>            { return this.rmvRenderpass(n) },
                recompile:      ()=>             { this.initGPU(false) },
                resize:         ()=>             { this.resize() },

                recompile_flag: this.store.recompile_flag,
                cmp_obj:        this.store.cmp_obj,
                layers:         this.store.layers_public,
                update_obj:     this.store.update_obj,
                renderpasses:   this.store.renderpasses,
                resolution:     this.store.resolution,
                atlas:          this.store.atlas,
                images: 		this.store.images,
                images_queue:   this.store.images_queue,
                pause_on_queue: this.store.pause_on_queue,
                camera:         this.store.camera,
                mouse:          this.store.mouse,

                // Misc functions
                renderAll: ()=>
                {
                    for (let i in this.store.layers)
                        this.store.layers[i].specs.update_flag =
                            this.store.layers[i].specs.render_flag = true;

                    // Batch all objects
                    let i = this.store.cmp_obj.length;
                    while (i--) this.store.cmp_obj[i].batch = true;
                },

                // Todo: deprecate
                get gpu         ()                { return this.store.gpu },
                updateAtlas: this.updateAtlas,
                store: this.store,
                initGPU : this.initGPU.bind(this),
            };

        this.mainLoop();

        return this.store.API;
    }

    initLib(opt={})
    {
        this.store = Object.assign(opt,
            {
                root:                       this,
                playing:                    false,
                hz:                         opt.hz || 60,

                // Timers
                timelapse_start:            Date.now(), // On initialization
                timelapse_total:            0,          // Since initialization
                timelapse_fps:              0,          // Since last frame was drawn
                timelapse_image_queue:      0,          // For store.image_process_hz
                timelapse_callback:         0,
                fps_timer:                  0,          // Since last fps incrementation
                fps_counter:                0,          // To increment current second's framecount
                fps_cap:                    opt.fps_cap || 60,
                fps:                        0,

                // Init Canvas
                gpu:                        null,
                canvas:                     opt.canvas,

                // Manager lists
                cmp_obj:                    [],         // For obj change comparision
                update_obj:                 [],         // An array of scheduled objects to update on next update loop
                layers:                     {},
                layer_keys:                 [],         // An ordered list of the float-based array key-indexes
                layers_public:              {},         // Public layer interface

                // Image & atlas
                images_main:                {},
                images:                     {},
                images_queue:               0,          // Amount of images currently being downloaded
                image_process_limit:        1,          // Limit the amount of image processes per mainLoop iteration
                image_process_hz:           150,        // The rate at which new images can be processed
                pause_on_queue:             true,       // Pause the renderer if there are images in queue
                MAX_TEXTURE_SIZE:           Math.max(WebGL2RenderingContext.MAX_TEXTURE_SIZE, 6000),
                MAX_TEXTURE_IMAGE_UNITS:    WebGL2RenderingContext.MAX_TEXTURE_IMAGE_UNITS,
                atlas_width:                0,
                atlas_height:               0,
                atlas_img:                  [],         // 2-Dimensional array of images by atlas page
                atlas:                      [],
                atlasCtx:                   [],
                u_atlas:                    [],         // Atlas uniform

                // Camera & mouse coords
                camera:                     { x:0, y:0, z:1, rotate:0 },
                mouse:                      { x:0, y:0 },

                // GPU kernel variables
                recompile_flag:             false,      // Recompile loop flag
                resolution:                 [0, 0],     // Cache resolution W & H values
                min_verts:                  24*100,     // Minimum amounts of verts to be available all the time
                attributes:                 [ "a_position", "a_property", "a_property2", "a_texCoord", "a_color" ],

                // Framebuffers
                fbo_resolution:             [1000, 1000],

                // Vertex data for rendering frames
                frame_vert:                 new Float32Array(32),
                frame_texCoord:             new Float32Array(32),

                // Render passes
                renderpasses:               {},
                renderpass_keys:            [],
            });

        // Setup resolution
        this.store.resolution[0] = opt.width || opt.canvas.width;
        this.store.resolution[1] = opt.height || opt.canvas.height;

        // Setup atlas
        this.addAtlas(0);

        this.initGPU();
    }

    initGPU(reset_context=false)
    {
        this.store.gpu = this.store.gpu || {};
        this.store.gpu = new this.webgl(this.store, reset_context);

        // Declare uniforms
        this.store.gpu.uniform("u_resolution",        (this.store.gpu.uniform["u_resolution"]||{})["values"]       ||       [0, 0]);  // u_resolution
        this.store.gpu.uniform("u_texResolution",     (this.store.gpu.uniform["u_texResolution"]||{})["values"]    ||       [0, 0]);  // u_texResolution
        this.store.gpu.uniform("u_fboResolution",     (this.store.gpu.uniform["u_fboResolution"]||{})["values"]    ||       [0, 0]);  // u_fboResolution
        this.store.gpu.uniform("u_camera",            (this.store.gpu.uniform["u_camera"]||{})["values"]           || [0, 0, 1, 0]);  // u_camera
        this.store.gpu.uniform("u_mouse",             (this.store.gpu.uniform["u_mouse"]||{})["values"]            ||       [0, 0]);  // u_mouse
        this.store.gpu.uniform("u_kernels",           (this.store.gpu.uniform["u_kernels"]||{})["values"]          ||          [0]);  // u_kernels
        this.store.gpu.uniform("u_delta",             (this.store.gpu.uniform["u_delta"]||{})["values"]            ||       [0, 0]);  // u_delta
        this.store.gpu.uniform("u_renderPass",        (this.store.gpu.uniform["u_renderPass"]||{})["values"]       ||         [-1]);  // u_renderPass
        this.store.gpu.uniform("u_atlasPagecount",    (this.store.gpu.uniform["u_atlasPagecount"]||{})["values"]   ||         [0]);  // u_atlasPagecount
        this.store.gpu.uniform("u_MAX_TEXTURE_SIZE",  (this.store.gpu.uniform["u_MAX_TEXTURE_SIZE"]||{})["values"] || [this.store.MAX_TEXTURE_SIZE]);  // u_MAX_TEXTURE_SIZE

        // Create framebuffer for main-frame
        this.store.gpu.framebuffer("main_frame");
        this.store.gpu.framebuffer("main_frame0");
        this.store.gpu.framebuffer("main_frame1");
        this.store.gpu.framebuffer("main_frame2");

        // Declare atlas pages
        for (let i=0; i<this.store.u_atlas.length || i===0; i++)
            this.store.u_atlas[i] = this.store.gpu.installTexture(`u_atlas${i}`);

        // Declare kernel attributes
        for (let i=0; i<this.store["attributes"].length; i++)
            this.store.gpu.attribute(this.store["attributes"][i], []);

        // Reset any existing framebuffers by re-adding the layers
        for (let i in this.store.layers) this.addLyr(i);

        // Declare renderpass uniforms, default vec4(0, 0, 0, 0)
        for (let i=0; i<this.store.renderpass_keys.length; i++)
            if (this.store.renderpasses[this.store.renderpass_keys[i]])
                for (let j in this.store.renderpasses[this.store.renderpass_keys[i]].uniforms)
                    this.store.gpu.uniform(j, [0, 0, 0, 0]);

        // Assemble additional renderpass shader code
        let renderpass_fn="", renderpass_calls="";
        for (let i=0; i<this.store.renderpass_keys.length; i++)
        {
            if (!this.store.renderpasses[this.store.renderpass_keys[i]]) continue;
            renderpass_calls += `if (u_renderPass - 100.0 == ${this.store.renderpass_keys[i].toFixed(1)}) fn_${this.store.renderpass_keys[i].toString().replace(".", "_")}();`;
            renderpass_fn += this.store.renderpasses[this.store.renderpass_keys[i]]["code"].replace("main", "fn_" + this.store.renderpass_keys[i].toString().replace(".", "_"));
        }

        // Atlas page swapper
        let page_swapper = "";
        for (let i=0; i<this.store.u_atlas.length; i++)
            page_swapper += `
                ${(i?"else ":"")}if (${`i==${i}`})
                    rtn = texture(u_atlas${i},
                        vec2(
                            v_texSpace.x * z / res_x + x / res_x,
                            v_texSpace.y * w / res_y + y / res_y
                        )
                    );
                `;

        // Compile shader code
        this.store.gpu.updateGL(
            {
                // language=GLSL
                head: `
                    out float opacity;
                    out vec4 v_texCoord;
                    out vec2 v_texSpace;
                    out vec2 v_texPos;
                    out vec4 v_color;
                    out float v_atlas_page;

                    float flipY;
                `,

                // language=GLSL
                body: `
                    void main()
                    {
                        vec2 position_2d = a_position.xy;
                        float flipY = u_kernels >= 1.0 ? 1.0 : -1.0;

                        // Transform rota   tion
                        if (flipY == -1.0 && a_property2.x != 0.0)
                        {
                            // Position to center
                            position_2d -= vec2(a_property.x + a_property.z/2.0, a_property.y + a_property.w/2.0);

                            // Rotate
                            if (a_property2.x != 0.0)
                            {
                                float angle = a_property2.x * (3.1415 / 180.0);
                                vec2 rotate = vec2(sin(angle), cos(angle));
                                position_2d = vec2(position_2d.x * rotate.y + position_2d.y * rotate.x,
                                position_2d.y * rotate.y - position_2d.x * rotate.x);
                            }

                            // Position back to origin
                            position_2d += vec2(a_property.x + a_property.z/2.0, a_property.y + a_property.w/2.0);
                        }

                        // Position relative to camera & property
                        if (flipY == -1.0 || flipY == 2.0) position_2d -= u_camera.xy;

                        position_2d = position_2d / (u_resolution/u_camera.z) * 2.0 - 1.0;
                        gl_Position = vec4(position_2d * vec2(1, min(1.0, flipY)), 0, 1);

                        opacity = a_property2.y;
                        v_texSpace = a_position.zw;
                        v_texPos = a_position.xy;
                        v_texCoord = a_texCoord;
                        v_atlas_page = a_property2.z;
                        
                        v_color = a_color;
                    }
                `,
            },
            {
                // language=GLSL
                head: `
                    out vec4 outColor;
                    in float opacity;

                    in vec4 v_texCoord;
                    in vec2 v_texSpace;
                    in vec4 v_color;
                    in float v_atlas_page;
                    int color[4];

                    vec4 pixel,
                         pixel_color;

                    float pixelX,
                          pixelY,
                          mouseX,
                          mouseY,
                          pixel_x, pixel_y;
                    
                    bool handleOut = true;

                    vec4 queryTexture(float x, float y)
                    {
                        vec4 rtn =  texture(
                            main_frame0,
                            vec2(v_texSpace.x * v_texCoord.z / u_texResolution.x + (v_texCoord.x+(x*-1.0)) / u_texResolution.x,
                            (v_texSpace.y * v_texCoord.w / u_texResolution.y + (v_texCoord.y+(y*-1.0)) / u_texResolution.y))
                        );

                        return rtn;
                    }
                    
                    vec4 queryAtlas(float x, float y, float z, float w)
                    {
                        vec4 rtn;
                    
                        float res_x = u_texResolution.x,
                              res_y = u_texResolution.y,
                              _x = v_texSpace.x * z / res_x + x / res_x;
                        
                        int i = int(v_atlas_page);
                        
                        ${page_swapper}
                        //else discard;
                        
                        return rtn;
                    }
                `,

                // language=GLSL
                body: renderpass_fn + `
                    void main()
                    {
                        mouseX = (u_mouse.x - u_camera.z) / (u_fboResolution[0]/u_resolution.x);
                        mouseY = (u_mouse.y - u_camera.z) / (u_fboResolution[1]/u_resolution.y);
                        pixelX = (v_texSpace.x * v_texCoord.z);
                        pixelY = (v_texSpace.y * v_texCoord.w);
                        
                        pixel_x = v_texSpace.x * u_fboResolution[0];
                        pixel_y = v_texSpace.y > 0.2 ? 400.0 : 0.0;
        
                        pixel = queryAtlas(v_texCoord.x, v_texCoord.y, v_texCoord.z, v_texCoord.w);
                                                
                        if (u_kernels == 1.0)
                        {
                            if (pixel.w == 0.0)
                                pixel = texture(
                                    main_frame0,
                                    vec2(v_texSpace.x * v_texCoord.z / u_texResolution.x + v_texCoord.x / u_texResolution.x,
                                         v_texSpace.y * v_texCoord.w / u_texResolution.y + v_texCoord.y / u_texResolution.y)
                                );
                            
                            pixel_color = texture(
                                main_frame2,
                                vec2(v_texSpace.x * v_texCoord.z / u_texResolution.x + v_texCoord.x / u_texResolution.x,
                                     v_texSpace.y * v_texCoord.w / u_texResolution.y + v_texCoord.y / u_texResolution.y)
                            );
                            
                            color[0] = int(v_color.x / 255.0);
                            //    v_color.x / 255.0,
                            //    v_color.y / 255.0,
                            //    v_color.z / 255.0,
                            //    v_color.w / 255.0
                            //);
                        }
                        
                        ${renderpass_calls}
                        
                        // Fill object with color
                        if (u_kernels == 0.0 && v_texCoord.x == -1.0)
                            pixel = v_color;
                        
                        // Opacity
                        if (u_kernels == 0.0)
                        {
                            if (pixel.w > 0.0)
                                pixel.w = min(opacity, pixel.w);
                        }
                        
                        // Color test
                        if (u_kernels == 0.5)
                        {
                            if (v_color.w > 0.0 && pixel.w > 0.0)
                                pixel = vec4(v_color.xyz, 1.0);
                            else
                                discard;
                        }
                        
                        // Fill the void
                        if (u_kernels == 1.0 && pixel.w == 0.0) discard;
                        else if (u_kernels == 2.0 && pixel.w == 0.0) pixel = vec4(0, 0, 0, 1);
                    
                        // Transfer pixel to colorbuffer
                        if (handleOut == true) outColor = pixel;
                    }
                `
            }
        );

        // Batch textures
        for (let i in this.store.gpu.textures)
            this.store.gpu.updateTexture(i);

        // Batch atlas pages
        for (let i=0; i<this.store.u_atlas.length; i++)
            if (this.store.atlas[i].width > 0 && this.store.atlas[i].height > 0)
                this.updateAtlas(i);
        this.store.gpu.uniform("u_atlasPagecount", this.store.u_atlas.length);

        // Mouse pointer reader
        this.store.canvas.onmousemove = function(e) {
            this.store.mouse.x = e.layerX - this.store.canvas.offsetLeft;
            this.store.mouse.y = e.layerY - this.store.canvas.offsetTop;
        }.bind(this);
    }

    mainLoop()
    {
        let ms = Date.now();

        // Transfer public variables
        {
            // Pull from API
            this.store.playing = !!this.store.API.playing;
            this.store.fps_cap = +this.store.API.fps_cap;
            this.store.hz = this.store.API.hz;
            this.store.recompile_flag = this.store.API.recompile_flag;
            this.store.pause_on_queue = this.store.API.pause_on_queue;

            // Push to API
            this.store.API.fps =
                this.store.playing === true
                || (this.store.pause_on_queue === true && this.store.images_queue > 0)
                    ? this.store.fps : 0;
            this.store.API.images_queue = Math.max(this.store.images_queue, 0);
        }

        // General updates/batches
        {
            // Recompile
            if (this.store.recompile_flag)
            {
                this.store.API.recompile_flag = false;
                this.store.API.recompile();
            }

            // Increment timelapse & buffer delta time
            this.store.timelapse_total = Date.now() - this.store.timelapse_start;
            this.store.gpu.uniform("u_delta", [this.store.timelapse_start, this.store.timelapse_total]);

            // On resolution update
            if (this.store.resolution[0] !== this.store.API.width
                || this.store.resolution[1] !== this.store.API.height)
            {
                this.store.resolution[0] = this.store.API.width;
                this.store.resolution[1] = this.store.API.height;
                this.store.root.resize();
            }

            // Update camera
            this.store.gpu.uniform("u_camera", [
                this.store.camera.x,
                this.store.camera.y,
                this.store.camera.z,
                this.store.camera.rotate]);

            // Update mouse position
            this.store.gpu.uniform("u_mouse", [this.store.mouse.x, -this.store.mouse.y + this.store.resolution[1]]);
        }

        // Image downloads processor
        {
            let atlas_updated = false;
            if (this.store.images_queue > 0
                && ms > this.store.timelapse_image_queue + this.store.image_process_hz)
            {
                this.store.timelapse_image_queue = ms;
                let update_count = 0;
                this.store.images_queue = 0;

                let i, key_images = Object.keys(this.store.images_main);
                for (let C=0; C<key_images.length; C++)
                {
                    i = key_images[C];

                    if (typeof this.store.images[i].atlas_i !== "undefined")
                        continue;

                    if (this.store.images[i].loaded < 2 || !this.store.images[i].el.complete)
                        this.store.images_queue++;

                    // Limit the amount of image processes per mainLoop iteration
                    if (update_count++ > this.store.image_process_limit
                        || !this.store.images[i].el.complete)
                        continue;

                    atlas_updated = this.store.atlas_updated = true;
                    this.store.images[i].loaded = 2;
                    this.store.images_queue--;
                    this.store.images[i].complete = true;

                    if (Object.keys(this.store.gpu.textures).length > this.store.MAX_TEXTURE_IMAGE_UNITS) continue;

                    // Add newly downloaded image to the atlas
                    {
                        let atlas_i = 0;

                        // Determine optimal placement
                        let _x=0, _y=0, brk, add, _step=32*8, x, y, _collide,
                            _w = this.store.images[i].el.width,
                            _h = this.store.images[i].el.height;
                        for (x=0, y=0, _collide=false; (!add && !brk) && x<this.store.MAX_TEXTURE_SIZE; x+=_step, _collide=false)
                        {
                            for (y=0; (!add && !brk) && y<this.store.MAX_TEXTURE_SIZE+_step; y+=_step, _collide=false)
                            {
                                // Detect collision with Y-edge
                                if (y+_h+_step > this.store.MAX_TEXTURE_SIZE)
                                {
                                    //y = 0;

                                    // In case it collided with X & Y: Move a page up
                                    if (x+_w+_step > this.store.MAX_TEXTURE_SIZE
                                        && y+_h+_step > this.store.MAX_TEXTURE_SIZE)
                                    {
                                        //x = 0;

                                        // Incremented atlas page does not exist; exit loop and place at 0x 0y
                                        if (!this.store.atlas[atlas_i+1])
                                        {
                                            x = y = 0;
                                            add = true;
                                            brk = false;
                                        }

                                        // Incremented atlas page exists; preserve the loop with break, and proceed on next page at 0x 0y
                                        else
                                        {
                                            x = y = 0;
                                            atlas_i++;
                                            brk = add = false;
                                        }

                                        break;
                                    }

                                    // Else, It only collided with Y-edge. Reset 0y
                                    break;
                                }

                                // Detect collisions with images
                                for (let i2=0, img; img = this.store.atlas_img[atlas_i][i2], i2<this.store.atlas_img[atlas_i].length; i2++)
                                    if (! (y + _h < img.sy
                                        || y > img.sy + img.el.height
                                        || x + _w < img.sx
                                        || x > img.sx + img.el.width) )
                                        _collide = true;

                                if (!_collide || !this.store.atlas_img[atlas_i].length)
                                {
                                    brk = true;
                                    _x = x;
                                    _y = y;
                                    break;
                                }
                            }

                            // Detect collision with X-edge
                            if (x+_w+_step > this.store.MAX_TEXTURE_SIZE)
                            {
                                //x = 0;

                                // In case it collided with X & Y: Move a page up
                                if (x+_w+_step > this.store.MAX_TEXTURE_SIZE
                                    && y+_h+_step > this.store.MAX_TEXTURE_SIZE)
                                {
                                    // Incremented atlas page does not exist; exit loop and place at 0x 0y
                                    if (!this.store.atlas[atlas_i+1])
                                    {
                                        x = y = 0;
                                        add = true;
                                        brk = false;
                                        break;
                                    }

                                    // Incremented atlas page exists; preserve the loop with continue, and proceed on next page at 0x 0y
                                    else
                                    {
                                        x = y = 0;
                                        atlas_i++;
                                        brk = add = false;
                                        continue;
                                    }
                                }

                                // Else, It only collided with X-edge. Reset 0x and continue
                                continue;
                            }

                            // Detect collisions with images
                            for (let i2=0, img; img = this.store.atlas_img[atlas_i][i2], i2<this.store.atlas_img[atlas_i].length; i2++)
                                if (! (y + _h < img.sy
                                    || y > img.sy + img.el.height
                                    || x + _w < img.sx
                                    || x > img.sx + img.el.width) )
                                    _collide = true;

                            if (!_collide || !this.store.atlas_img[atlas_i].length)
                            {
                                brk = true;
                                _x = x;
                                _y = y;
                                break;
                            }
                        }

                        // Determine atlas page; add atlas if latest unit exceeds gl.MAX_TEXTURE_SIZE
                        if (!brk && this.store.atlas_img[atlas_i].length)
                        {
                            atlas_i++;
                            this.store.u_atlas[atlas_i] = this.store.gpu.installTexture(`u_atlas${atlas_i}`);
                            this.addAtlas(atlas_i+1);
                            this.store.API.recompile_flag = true;
                        }

                        // Add new resource
                        this.store.atlasCtx[atlas_i].drawImage(this.store.images[i].el, _x, _y);
                        /*//this.store.gpu.gl.activeTexture(this.store.gpu.gl.TEXTURE0 + this.store.gpu.textures[`u_atlas${atlas_i}`]["index"]);
                        this.store.gpu.gl.bindTexture(this.store.gpu.gl.TEXTURE_2D, this.store.gpu.textures[`u_atlas${atlas_i}`]["texture"]);

                        this.store.gpu.gl.texStorage2D(
                            this.store.gpu.gl.TEXTURE_2D,
                            1,
                            this.store.gpu.gl.RGBA8,
                            this.store.MAX_TEXTURE_SIZE,
                            this.store.MAX_TEXTURE_SIZE
                        );
                        this.store.gpu.gl.texSubImage2D(
                            this.store.gpu.gl.TEXTURE_2D,
                            0,
                            _x,
                            _y,
                            this.store.images[i].el.width,
                            this.store.images[i].el.height,
                            this.store.gpu.gl.RGBA,
                            this.store.gpu.gl.UNSIGNED_BYTE,
                            this.store.images[i].el
                        );
                        //this.store.gpu.updateTexture(`u_atlas${atlas_i}`);*/

                        // Set atlas source data
                        this.store.images[i].sx = _x;
                        this.store.images[i].sy = _y;
                        this.store.images[i].sw = this.store.images[i].el.width;
                        this.store.images[i].sh = this.store.images[i].el.height;

                        this.store.images[i].atlas_i = atlas_i;
                        this.store.atlas_img[atlas_i].push(this.store.images[i]);
                        this.store.images[i].complete = true;
                    }
                }
            }

            // Recalculate images_queue based on atlas complete status
            let queue_count = 0;
            for (let i in this.store.images)
                if (this.store.images[i].complete !== true)
                    queue_count++;
            this.store.images_queue = this.store.API.images_queue = queue_count;
        }

        if (this.store.playing === false
            || (this.store.pause_on_queue === true && this.store.images_queue > 0))
        {
            if (this.store.playing === false)
                return setTimeout(this.mainLoop.bind(this), 1000/this.store.fps_cap);

            // Update loop
            // Todo: Deprecate! we need to do without...
            for (let layer_i=0, layer=0; layer_i<this.store.layer_keys.length; layer_i++)
            {
                layer = this.store.layers[this.store.layer_keys[layer_i]];

                // If layer is defined as static, only process it when render flag is true
                if (!layer || !!layer.specs.static && !layer.specs.update_flag) continue;

                layer.specs.update_flag = false;
                layer.width = layer.height = 0; // Recalculate layer width & height

                // Process objects
                for (let obj_i=0, obj; obj_i<layer.obj.length; obj_i++)
                {
                    obj = layer.obj[obj_i];

                    // Update respective layer's resolution
                    layer.width = Math.max(layer.width, obj.ref["x"]+obj.ref["width"]);
                    layer.height = Math.max(layer.height, obj.ref["y"]+obj.ref["height"]);

                    this.updateObj(obj);
                }

                // Extend vertex arrays
                if (layer.extend_flag === true)
                {
                    layer.extend_flag = false;
                    for (let i=0; i<this.store["attributes"].length; i++)
                        layer[this.store["attributes"][i]+"_f32"] = new Float32Array(layer[this.store["attributes"][i]]);
                }
            }

            // Update loop for specific objects
            if (this.store.update_obj.length > 0)
            {
                for (let i=0; i<this.store.update_obj.length; i++)
                    this.updateObj(this.store.update_obj[i]);
                this.store.update_obj = this.store.API.update_obj = [];
            }

            // Draw loop
            this.draw();

            return setTimeout(this.mainLoop.bind(this), 1000/this.store.fps_cap);
        }

        // Upload the updated atlas
        if (this.store.atlas_updated === true)
        {
            this.store.atlas_updated = false;

            for (let i=0; i<this.store.u_atlas.length; i++)
                this.store.root.updateAtlas(i);

            this.store.API.recompile();
            this.store.API.renderAll();
        }

        // Update loop for specific objects
        if (this.store.update_obj.length > 0)
        {
            for (let i=0; i<this.store.update_obj.length; i++)
                this.updateObj(this.store.update_obj[i]);

            this.store.update_obj = this.store.API.update_obj = [];
        }

        // Update loop
        for (let layer_i=0, layer=0; layer_i<this.store.layer_keys.length; layer_i++)
        {
            layer = this.store.layers[this.store.layer_keys[layer_i]];

            // If layer is defined as static, only process it when render flag is true
            if (!layer || !!layer.specs.static && !layer.specs.update_flag) continue;

            layer.specs.update_flag = false;
            layer.width = layer.height = 0; // Recalculate layer width & height

            // Process objects
            for (let obj_i=0, obj; obj_i<layer.obj.length; obj_i++)
            {
                obj = layer.obj[obj_i];

                // Update respective layer's resolution
                layer.width = Math.max(layer.width, obj.ref["x"]+obj.ref["width"]);
                layer.height = Math.max(layer.height, obj.ref["y"]+obj.ref["height"]);

                this.updateObj(obj);
            }

            // Extend vertex arrays
            if (layer.extend_flag === true)
            {
                layer.extend_flag = false;
                for (let i=0; i<this.store["attributes"].length; i++)
                    layer[this.store["attributes"][i]+"_f32"] = new Float32Array(layer[this.store["attributes"][i]]);
            }
        }

        // Draw loop
        this.draw();

        setTimeout(this.mainLoop.bind(this), 1000/this.store.hz);
    }

    draw()
    {
        let ms = Date.now();
        this.store.timelapse_fps = ms - this.store.timelapse_callback;

        if (this.store.timelapse_fps > 1000/this.store.fps_cap)
        {
            this.store.timelapse_callback = ms - (this.store.timelapse_fps % (1000/this.store.fps_cap));

            // Draw calls (WebGL2)
            if (this.store.cmp_obj.length > 0)
            {
                // KERNEL 0: Draw objects into FBOs
                {
                    this.store.gpu.gl.bindFramebuffer(this.store.gpu.gl.FRAMEBUFFER, this.store.gpu.framebuffers["main_frame1"]["fbo"]);
                    this.store.gpu.clear();

                    this.store.gpu.uniform("u_texResolution", [this.store.MAX_TEXTURE_SIZE, this.store.MAX_TEXTURE_SIZE]);
                    this.store.gpu.gl.activeTexture(this.store.gpu.gl.TEXTURE0 + this.store.gpu.textures[`u_atlas0`]["index"]);

                    for (let i=0, layer; i<this.store.layer_keys.length; i++)
                    {
                        layer = this.store.layers[this.store.layer_keys[i]];
                        if (!layer.obj.length || !layer.width || !layer.height) continue;

                        if (layer.specs.render_flag === true || layer.specs.static !== true || true)
                        {
                            this.store.gpu.attribute("a_position",  layer["a_position_f32"]);
                            this.store.gpu.attribute("a_property",  layer["a_property_f32"]);
                            this.store.gpu.attribute("a_property2", layer["a_property2_f32"]);
                            this.store.gpu.attribute("a_texCoord",  layer["a_texCoord_f32"]);
                            this.store.gpu.attribute("a_color",     layer["a_color_f32"]);

                            // Set renderpass kernels
                            {
                                this.store.gpu.uniform("u_renderPass", -1);

                                for (let j=0; j<this.store.renderpass_keys.length; j++)
                                    if (this.store.renderpasses[this.store.renderpass_keys[j]]
                                        && +this.store.renderpass_keys[j] === +this.store.layer_keys[i]
                                        && this.store.renderpasses[this.store.renderpass_keys[j]].target === 0)
                                    {
                                        // Batch related uniforms
                                        let uni = this.store.renderpasses[this.store.renderpass_keys[j]].uniforms;
                                        for (let k in uni)
                                            this.store.gpu.uniform(k, [
                                                uni[k][0], uni[k][1],
                                                uni[k][2], uni[k][3],
                                            ]);

                                        this.store.gpu.uniform("u_renderPass", 100 + this.store.renderpass_keys[j]);
                                        break;
                                    }
                            }

                            this.store.root.resize(this.store.resolution[0], this.store.resolution[1]);
                            this.store.gpu.gl.bindTexture(this.store.gpu.gl.TEXTURE_2D, this.store["u_atlas"][0]["texture"]);
                            this.store.gpu.gl.bindFramebuffer(this.store.gpu.gl.FRAMEBUFFER, layer["fbo"]["fbo"]);
                            this.store.gpu.clear();

                            // Draw original
                            this.store.gpu.uniform("u_kernels", 0);
                            this.store.gpu.drawObjects();

                            // Draw color masks to main_frame1
                            this.store.gpu.uniform("u_kernels", 0.5);
                            this.store.gpu.gl.bindFramebuffer(this.store.gpu.gl.FRAMEBUFFER, this.store.gpu.framebuffers["main_frame1"]["fbo"]);
                            this.store.gpu.drawObjects();

                            // Copy main_frame1 to main_frame2
                            this.store.gpu.gl.bindTexture(this.store.gpu.gl.TEXTURE_2D, this.store.gpu.textures["main_frame2"]["texture"]);
                            this.store.gpu.gl.copyTexImage2D(this.store.gpu.gl.TEXTURE_2D, 0, this.store.gpu.gl.RGBA, 0, 0, this.store.fbo_resolution[0], this.store.fbo_resolution[1], 0);
                        }
                    }
                }

                // KERNEL 1: Draw FBOs into main_frame
                {
                    this.store.gpu.uniform("u_kernels", 1);
                    this.store.gpu.uniform("u_texResolution", [this.store.resolution[0], this.store.resolution[1]]);
                    this.store.gpu.attribute("a_position", this.store["frame_vert"]);
                    this.store.gpu.attribute("a_property", this.store["frame_vert"]);
                    this.store.gpu.attribute("a_texCoord", this.store["frame_texCoord"]);

                    this.store.gpu.gl.bindFramebuffer(this.store.gpu.gl.FRAMEBUFFER, this.store.gpu.framebuffers["main_frame0"]["fbo"]);
                    this.store.gpu.clear();
                    this.store.gpu.gl.bindFramebuffer(this.store.gpu.gl.FRAMEBUFFER, this.store.gpu.framebuffers["main_frame"]["fbo"]);
                    this.store.gpu.clear();

                    for (let i=0, layer; i<this.store.layer_keys.length; i++)
                    {
                        layer = this.store.layers[this.store.layer_keys[i]];

                        // If layer has no objects, clear buffer
                        if (layer.obj.length < 1)
                        {
                            this.store.gpu.gl.bindFramebuffer(this.store.gpu.gl.FRAMEBUFFER, layer["fbo"]["fbo"]);
                            this.store.gpu.clear();
                            this.store.gpu.gl.bindFramebuffer(this.store.gpu.gl.FRAMEBUFFER, this.store.gpu.framebuffers["main_frame"]["fbo"]);
                        }

                        layer.specs.render_flag = false;
                        this.store.gpu.uniform("u_fboResolution", [layer.fbo.width, layer.fbo.height]);

                        // Set renderpass kernels
                        {
                            this.store.gpu.uniform("u_renderPass", -1);

                            for (let j=0; j<this.store.renderpass_keys.length; j++)
                                if (this.store.renderpasses[this.store.renderpass_keys[j]]
                                    && +this.store.renderpass_keys[j] === +this.store.layer_keys[i]
                                    && this.store.renderpasses[this.store.renderpass_keys[j]].target === 1)
                                {
                                    // Batch related uniforms
                                    let uni = this.store.renderpasses[this.store.renderpass_keys[j]].uniforms;
                                    for (let k in uni)
                                        this.store.gpu.uniform(k, [
                                            uni[k][0], uni[k][1],
                                            uni[k][2], uni[k][3],
                                        ]);

                                    this.store.gpu.uniform("u_renderPass", 100 + this.store.renderpass_keys[j]);
                                    break;
                                }
                        }

                        this.store.gpu.gl.bindTexture(this.store.gpu.gl.TEXTURE_2D, layer["fbo"]["texture"]["texture"]);
                        this.store.gpu.drawFrame();

                        // Copy main_frame to main_frame0
                        this.store.gpu.gl.bindTexture(this.store.gpu.gl.TEXTURE_2D, this.store.gpu.textures["main_frame0"]["texture"]);
                        this.store.gpu.gl.copyTexImage2D(this.store.gpu.gl.TEXTURE_2D, 0, this.store.gpu.gl.RGBA, 0, 0, this.store.fbo_resolution[0], this.store.fbo_resolution[1], 0);
                    }
                }

                // KERNEL 2: Draw main_frame
                {
                    this.store.gpu.uniform("u_kernels", 2);

                    this.store.gpu.gl.bindTexture(this.store.gpu.gl.TEXTURE_2D, this.store.gpu.textures["main_frame"]["texture"]);
                    this.store.gpu.gl.bindFramebuffer(this.store.gpu.gl.FRAMEBUFFER, null);
                    this.store.gpu.clear();
                    this.store.gpu.drawFrame(this.store.canvas.width, this.store.canvas.height);
                }
            }

            // Increment FPS counter
            {
                if (ms-this.store.fps_timer >= 1000)
                {
                    this.store.fps_timer = ms;
                    this.store.fps = this.store.fps_counter;
                    this.store.fps_counter = 0;
                }

                this.store.fps_counter++;
            }
        }
    }

    // Objects
    addObj(opt={})
    {
        let obj = Object.assign(opt,
            {
                layer:   opt.layer   || 0,
                x:       opt.x       || 0,
                y:       opt.y       || 0,
                width:   opt.width   || 32,
                height:  opt.height  || 32,

                color:   opt.color   || 0x000000,
                rotate:  opt.rotate  || 0,
                opacity: opt.opacity || 1,
            });

        let cmp_obj = Object.assign({
            ref: obj,
            vert_index: 0,
            batch: false, // Flag: batch all vertices before next draw call
        }, obj);

        // Set default cmp values to force a first update
        cmp_obj["batch"] = true;
        this.store.cmp_obj.push(cmp_obj);

        this.addLyr(obj.layer);
        this.store.layers[obj.layer].obj.push(cmp_obj);
        this.store.layers[obj.layer].specs.render_flag = true;

        // Give it a vert index and/or expand array
        {
            let expand = true,
                a_position = this.store.layers[obj.layer]["a_position"];

            for (let i=0; i<=a_position.length; i+=24)
                if (a_position[i] === -1)
                {
                    cmp_obj.vert_index = i;
                    if (i <= a_position.length-24) expand = false;
                    break;
                }

            // Expand vert arrays
            if (expand === true)
            {
                this.store.layers[obj.layer].extend_flag = true;

                cmp_obj.vert_index = this.store.layers[obj.layer]["a_position"].length;

                for (let i=0; i<this.store["attributes"].length; i++)
                {
                    this.store.layers[obj.layer][this.store["attributes"][i]] =
                        this.store.layers[obj.layer][this.store["attributes"][i]].concat(Array(this.store.min_verts).fill(-1));

                    this.store.layers[obj.layer][this.store["attributes"][i]+"_f32"] = this.store.layers[obj.layer][this.store["attributes"][i]];
                }
            }

            // Fill verts with dedicated values
            let attr_vals = { a_texCoord: -1 };
            for (let i=0; i<24; i++)
                for (let j=0; j<this.store["attributes"].length; j++)
                    this.store.layers[cmp_obj.layer][this.store["attributes"][j]][cmp_obj.vert_index + i] =
                        attr_vals[this.store["attributes"][j]] || 0;
        }

        return obj;
    }

    rmvObj(obj)
    {
        let layer,
            cmp_obj;

        // Always resolve obj as the public object
        obj = obj.ref || obj;

        // Remove from layer
        for (let layer_i=0, brk=false; layer_i<this.store.layer_keys.length; layer_i++)
        {
            layer = this.store.layer_keys[layer_i];

            for (let i=0; i<this.store.layers[layer].obj.length; i++)
                if (this.store.layers[layer].obj[i].ref === obj)
                {
                    cmp_obj = this.store.layers[layer].obj[i];
                    this.store.layers[layer].obj.splice(i, 1);
                    brk = true;
                    break;
                }

            if (brk === true) break;
        }

        // Remove from cmp list
        for (let i=0; i<this.store.cmp_obj.length; i++)
            if (this.store.cmp_obj[i].ref === obj)
            {
                cmp_obj = this.store.cmp_obj[i];
                this.store.cmp_obj.splice(i, 1);
                break;
            }

        // Nullify the object's verts for future entries
        for (let i=0; i<24; i++)
            for (let j=0; j<this.store["attributes"].length; j++)
                this.store.layers[layer][this.store["attributes"][j]][cmp_obj.vert_index + i] =
                    this.store.layers[layer][this.store["attributes"][j]+"_f32"][cmp_obj.vert_index + i] = -1;
    }

    // Find a CMP object by REF
    findObj(ref)
    {
        let i = this.store.cmp_obj.length;
        while (i--)
            if (this.store.cmp_obj[i].ref === ref)
                return this.store.cmp_obj[i].ref;
        return false;
    }

    // Run scheduled on a single object
    updateObj(obj)
    {
        if (!obj.ref) return;

        // Assume obj is a compare object
        if (!obj.ref)
            for (let i=0; i<this.store.cmp_obj.legngth; i++)
                if (this.store.cmp_obj[i].ref === obj)
                {
                    obj = this.store.cmp_obj[i];
                    break;
                }

        let layer = this.store.layers[obj.layer];
        if (!layer) return;

        // Process specific properties
        {
            // If image is nonexistent, add it
            if(!this.store.images[obj.ref.image]) this.store.root.addImage(obj.ref.image);

            // Image, add obj to collection
            if (obj.ref.image
                && this.store.images[obj.ref.image]
                && this.store.images[obj.ref.image].complete !== true
                && !this.store.images[obj.ref.image].obj.includes(obj))
                this.store.images[obj.ref.image].obj.push(obj);

            // Layer swap
            if (obj.layer !== obj.ref.layer)
            {
                // Flag render for both layers
                if (this.store.layers[obj.layer]) this.store.layers[obj.layer].specs.render_flag = true;
                if (this.store.layers[obj.ref.layer]) this.store.layers[obj.ref.layer].specs.render_flag = true;

                this.store.root.addLyr(obj.ref.layer);
                this.store.root.rmvObj.bind(this)(obj);
                obj.layer = obj.ref.layer;
                this.store.root.addObj.bind(this)(obj.ref);
            }
        }

        // Translate values to attribute data
        {
            // Skip if object isn't visible within viewport
            if (!layer.specs.static !== true
                && !(obj.ref["x"]+obj.ref["width"] >= this.store.camera.x
                    && obj.ref["y"]+obj.ref["height"] >= this.store.camera.y
                    && obj.ref["x"] <= this.store.camera.x + this.store.resolution[0]
                    && obj.ref["y"] <= this.store.camera.y + this.store.resolution[1]))
            {
                if (layer["a_property2_f32"][obj["vert_index"]] === 0) return;

                layer.specs.render_flag = true;

                // Erase from buffer
                for (let i=0; i<24; i++)
                    layer["a_property2_f32"][obj["vert_index"]+i] =
                        layer["a_property2"][obj["vert_index"]+i] = 0;

                // Force a redraw when it's visible again
                obj["batch"] = true;

                return;
            }

            // x, y, width, height
            if (obj["batch"] === true
                || obj["x"] !== obj.ref["x"]
                || obj["y"] !== obj.ref["y"]
                || obj["width"] !== obj.ref["width"]
                || obj["height"] !== obj.ref["height"])
            {
                // Transfer values
                obj["x"] = obj.ref["x"];
                obj["y"] = obj.ref["y"];
                obj["width"] = obj.ref["width"];
                obj["height"] = obj.ref["height"];

                // a_position
                let verts = [
                    obj.ref["x"], obj.ref["y"], 0, 0,
                    obj.ref["x"]+obj.ref["width"], obj.ref["y"], 1, 0,
                    obj.ref["x"], obj.ref["y"]+obj.ref["height"], 0, 1,
                    obj.ref["x"], obj.ref["y"]+obj.ref["height"], 0, 1,
                    obj.ref["x"]+obj.ref["width"], obj.ref["y"], 1, 0,
                    obj.ref["x"]+obj.ref["width"], obj.ref["y"]+obj.ref["height"], 1, 1
                ];

                for (let i=0; i<24; i++)
                    layer["a_position_f32"][obj["vert_index"]+i] =
                        layer["a_position"][obj["vert_index"]+i] = verts[i];

                // a_property
                verts = [
                    obj.ref["x"], obj.ref["y"], obj.ref["width"], obj.ref["height"],
                    obj.ref["x"], obj.ref["y"], obj.ref["width"], obj.ref["height"],
                    obj.ref["x"], obj.ref["y"], obj.ref["width"], obj.ref["height"],
                    obj.ref["x"], obj.ref["y"], obj.ref["width"], obj.ref["height"],
                    obj.ref["x"], obj.ref["y"], obj.ref["width"], obj.ref["height"],
                    obj.ref["x"], obj.ref["y"], obj.ref["width"], obj.ref["height"]
                ];

                for (let i=0; i<24; i++)
                    layer["a_property_f32"][obj["vert_index"]+i] =
                        layer["a_property"][obj["vert_index"]+i] = verts[i];

                layer.specs.render_flag = true;
            }

            // rotate, opacity, image/atlas_page
            if (obj["batch"] === true
                || obj["rotate"] !== obj.ref["rotate"]
                || obj["opacity"] !== obj.ref["opacity"]
                || obj["image"] !== obj.ref["image"])
            {
                // Transfer values
                obj["rotate"] = obj.ref["rotate"] = +obj.ref["rotate"];
                obj["opacity"] = obj.ref["opacity"] = +obj.ref["opacity"];

                let verts = [
                    obj.ref["rotate"], obj.ref["opacity"], (this.store.images[obj.ref["image"]]||{})["atlas_i"], 0,
                    obj.ref["rotate"], obj.ref["opacity"], (this.store.images[obj.ref["image"]]||{})["atlas_i"], 0,
                    obj.ref["rotate"], obj.ref["opacity"], (this.store.images[obj.ref["image"]]||{})["atlas_i"], 0,
                    obj.ref["rotate"], obj.ref["opacity"], (this.store.images[obj.ref["image"]]||{})["atlas_i"], 0,
                    obj.ref["rotate"], obj.ref["opacity"], (this.store.images[obj.ref["image"]]||{})["atlas_i"], 0,
                    obj.ref["rotate"], obj.ref["opacity"], (this.store.images[obj.ref["image"]]||{})["atlas_i"], 0,
                ];

                for (let i=0; i<24; i++)
                    layer["a_property2_f32"][obj["vert_index"]+i] =
                        layer["a_property2"][obj["vert_index"]+i] = verts[i];

                layer.specs.render_flag = true;
            }

            // image, sx,sy,sw,sh
            if (obj.ref["image"]
                && this.store.images[obj.ref["image"]].complete === true
                && (obj["batch"] === true
                    || obj["sx"] !== obj.ref["sx"]
                    || obj["sy"] !== obj.ref["sy"]
                    || obj["sw"] !== obj.ref["sw"]
                    || obj["sh"] !== obj.ref["sh"]))
            {
                // Transfer values
                obj["sx"] = obj.ref["sx"];
                obj["sy"] = obj.ref["sy"];
                obj["sw"] = obj.ref["sw"];
                obj["sh"] = obj.ref["sh"];

                let sx = (obj.ref["sx"]||0) + this.store.images[obj.ref["image"]]["sx"],
                    sy = (obj.ref["sy"]||0) + this.store.images[obj.ref["image"]]["sy"],
                    sw = obj.ref["sw"] || this.store.images[obj.ref["image"]]["sw"],
                    sh = obj.ref["sh"] || this.store.images[obj.ref["image"]]["sh"];

                let verts = [
                    sx, sy, sw, sh,
                    sx, sy, sw, sh,
                    sx, sy, sw, sh,
                    sx, sy, sw, sh,
                    sx, sy, sw, sh,
                    sx, sy, sw, sh,
                ];

                for (let i=0; i<24; i++)
                    layer["a_texCoord_f32"][obj["vert_index"]+i] =
                        layer["a_texCoord"][obj["vert_index"]+i] = verts[i];

                layer.specs.render_flag = true;
            }

            // color
            if (obj["batch"] === true
                || obj["color"] !== obj.ref["color"])
            {
                // Transfer values
                obj["color"] = obj.ref["color"];

                let r = obj["color"] && ((obj["color"] & 0xFF0000) >>> 16) / 255,
                    g = obj["color"] && ((obj["color"] & 0xFF00) >>> 8) / 255,
                    b = obj["color"] && (obj["color"] & 0xFF) / 255,
                    a = obj["color"] ? 1 : 0;

                let verts = [
                    r, g, b, a,
                    r, g, b, a,
                    r, g, b, a,
                    r, g, b, a,
                    r, g, b, a,
                    r, g, b, a,
                ];

                for (let i=0; i<24; i++)
                    layer["a_color_f32"][obj["vert_index"]+i] =
                        layer["a_color"][obj["vert_index"]+i] = verts[i];

                layer.specs.render_flag = true;
            }

            if (obj["batch"] === true) obj["batch"] = false;
        }
    }

    // Layers
    addLyr(n, opt={})
    {
        // Layer already exists; inherit specs and create framebuffer
        if (this.store.layers[n])
        {
            this.store.layers[n].specs.static = opt.static || this.store.layers[n].specs.static;

            // Restore frame buffers & set render flag
            {
                this.store.layers[n].fbo =
                    this.store.gpu.framebuffer("layer_"+n.toString().replace(".", "_"));
                this.store.layers[n].specs.render_flag = true;
            }

            return this.store.layers[n];
        }

        let layer =
            this.store.layers[n] =
                Object.assign({
                    obj: [],
                    index: n,
                    extend_flag: true,
                    width: 0,
                    height: 0,

                    specs: {
                        static: opt.static || false,
                        render_flag: true,
                        update_flag: true,
                    }
                }, opt);

        // Extend public layer list
        this.store.layers_public[n] = layer.specs;

        // Update layer keys array
        this.store.layer_keys = Object.keys(this.store.layers).sort((a,b)=>a-b).map(Number);

        // Declare layer-based attributes
        for (let i=0; i<this.store["attributes"].length; i++)
        {
            layer[this.store["attributes"][i]] = [];
            layer[this.store["attributes"][i]+"_f32"] = new Float32Array();
        }

        // Add framebuffer for layer caching
        n = "layer_" + n.toString().replace(".", "_");
        layer.fbo = this.store.gpu.framebuffer(n);

        return layer.specs;
    }

    // Renderpasses
    addRenderpass(n, opt={})
    {
        let rp = this.store.renderpasses[n] = this.store.renderpasses[n] || opt;
        rp.target = opt.target;
        rp.code = opt.code;
        rp.uniforms = opt.uniforms || rp.uniforms || {};

        this.store.renderpass_keys = Object.keys(this.store.renderpasses).sort((a,b)=>a-b).map(Number);
        this.initGPU();

        // Add target layer if it doesn't exist
        if (!this.store.layers[n]) this.addLyr(n);

        return rp;
    }

    rmvRenderpass(n)
    {
        delete this.store.renderpasses[n];
    }

    // Media
    addImage(res, base="")
    {
        let url_original = base + res,
            res_src = base === ""
                ? (new URL(res, location.origin)).href
                : base + res;

        if (this.store.images[url_original]
            || this.store.images[res_src])
            return this.store.images[res_src];

        // Resolve "res" as a HTMLElement and use the URL as the key
        if (typeof res === "string")
            res = document.createElement("img");

        else return;

        if (!this.store.images[res_src])
            this.store.images_queue++;

        this.store.images[res_src] =
            this.store.images_main[res_src] =
                this.store.images[res_src] || {
                    store: this.store,
                    res_src: res_src,
                    url_original: url_original,

                    loaded: 0,
                    el: res,
                    complete: false,
                    obj: []
                };

        this.store.images[url_original] = this.store.images[res_src];

        res.onload = function() {
            this.store.images[this.res_src].loaded = 1;
        }.bind(this.store.images[res_src]);

        res.src = res_src;

        return res;
    }

    // Expand atlas unites/pages to n
    addAtlas(n)
    {
        for (let i=0; i<=n; i++)
        {
            if (this.store.atlas[i]) continue;

            let id = 0;
            while (document.querySelector("#render_atlas_" + id)) id++;

            this.store.atlas_img[i] = [];
            this.store.atlas[i] = document.createElement("canvas");
            this.store.atlas[i].id = "render_atlas_" + id;
            this.store.atlas[i].width = this.store.atlas[i].height = this.store.MAX_TEXTURE_SIZE;
            this.store.atlasCtx[i] = this.store.atlas[i].getContext("2d");

            // Todo: deprecate
            if (/renderer/.test(location.href))
                document.querySelector("body").append(this.store.atlas[this.store.atlas.length-1]);
        }
    }

    updateAtlas(n=0)
    {
        // Update texture resolution uniform
        this.store.gpu.uniform("u_texResolution", [this.store.MAX_TEXTURE_SIZE, this.store.MAX_TEXTURE_SIZE]);

        // Batch the updated texture
        this.store.gpu.updateTexture(`u_atlas${n}`, this.store.atlas[n]);
    }

    // Misc
    resize(w=null, h=null)
    {
        // Optionally inherit current canvas resolution
        w = w || this.store.resolution[0];
        h = h || this.store.resolution[1];

        // Buffer resolution data
        this.store.resolution = [w, h];
        this.store.gpu.uniform("u_resolution", this.store.resolution);

        // Generate new frame-vertex's
        this.store["frame_vert"].set([
            0, 0, 0, 0,
            this.store.fbo_resolution[0], 0, 1, 0,
            0, this.store.fbo_resolution[1], 0, 1,
            0, this.store.fbo_resolution[1], 0, 1,
            this.store.fbo_resolution[0], 0, 1, 0,
            this.store.fbo_resolution[0], this.store.fbo_resolution[0], 1, 1
        ], 0);

        this.store["frame_texCoord"].set([
            0, 0, w, h,
            0, 0, w, h,
            0, 0, w, h,
            0, 0, w, h,
            0, 0, w, h,
            0, 0, w, h,
        ], 0);
    }
}