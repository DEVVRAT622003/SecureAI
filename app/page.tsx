"use client"
import { ModeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { beep } from '@/utils/audio';
import { Camera, Divide, FlipHorizontal, MoonIcon, PersonStanding, SunIcon, Video, Volume2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react'
import { Rings } from 'react-loader-spinner';
import Webcam from 'react-webcam';
import { toast } from "sonner"
import * as cocossd from '@tensorflow-models/coco-ssd'
import "@tensorflow/tfjs-backend-cpu"
import "@tensorflow/tfjs-backend-webgl"
import { DetectedObject, ObjectDetection } from '@tensorflow-models/coco-ssd';
import { drawOnCanvas } from '@/utils/draw';

type Props = {}

let interval: any = null;
let stopTimeout: any = null;

const HomePage = (props: Props) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // state 
  const [mirrored, setMirrored] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [autoRecordEnabled, setAutoRecordEnabled] = useState<boolean>(false)
  const [volume, setVolume] = useState(0.8);
  const [model, setModel] = useState<ObjectDetection>();
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // initialize the media recorder
  useEffect(() => {
    if (webcamRef && webcamRef.current) {
      const stream = (webcamRef.current.video as any).captureStream();
      if (stream) {
        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) {
            const recordedBlob = new Blob([e.data], { type: 'video' });
            const videoURL = URL.createObjectURL(recordedBlob);

            const a = document.createElement('a');
            a.href = videoURL;
            a.download = `${formatDate(new Date())}.webm`;
            a.click();
          }
        };
        mediaRecorderRef.current.onstart = (e) => {
          setIsRecording(true);
        }
        mediaRecorderRef.current.onstop = (e) => {
          setIsRecording(false);
        }
      }
    }
  }, [webcamRef])


  useEffect(() => {
    setLoading(true);
    initModel();
  }, [])

  // loads model 
  // set it in a state varaible
  async function initModel() {
    const loadedModel: ObjectDetection = await cocossd.load({
      base: 'mobilenet_v2'
    });
    setModel(loadedModel);
  }

  useEffect(() => {
    if (model) {
      setLoading(false);
    }
  }, [model])


  async function runPrediction() {
    if (
      model
      && webcamRef.current
      && webcamRef.current.video
      && webcamRef.current.video.readyState === 4
    ) {
      const predictions: DetectedObject[] = await model.detect(webcamRef.current.video);

      resizeCanvas(canvasRef, webcamRef);
      drawOnCanvas(mirrored, predictions, canvasRef.current?.getContext('2d'))

      let isPerson: boolean = false;
      if (predictions.length > 0) {
        predictions.forEach((prediction) => {
          isPerson = prediction.class === 'person';
        })

        if (isPerson && autoRecordEnabled) {
          startRecording(true);
        }
      }
    }
  }

  useEffect(() => {
    interval = setInterval(() => {
      runPrediction();
    }, 100)

    return () => clearInterval(interval);
  }, [webcamRef.current, model, mirrored, autoRecordEnabled, runPrediction])

  return(
    <div className='flex flex-col md:flex-row h-screen'>
  {/* Left division - webcam and Canvas */}
  <div className='relative flex-1 md:w-9/10'>
    <div className='relative h-screen w-full'>
      <Webcam ref={webcamRef}
        mirrored={mirrored}
        className='h-full w-full object-contain p-2'
      />
      <canvas ref={canvasRef}
        className='absolute top-0 left-0 h-full w-full object-contain'
      ></canvas>
    </div>
  </div>

  {/* Right division - container for button panel and wiki section */}
  <div className='flex flex-col md:flex-row md:w-1/10 m-auto'>
    <div className='border-primary/5 border-2 max-w-xs flex flex-row md:flex-col  gap-2 justify-between shadow-md rounded-md p-4 md:h-full'>
      {/* Top section */}
      <div className='flex flex-col gap-2'>
        <ModeToggle />
        <Button
          variant={'outline'} size={'icon'}
          onClick={() => {
            setMirrored((prev) => !prev)
          }}
        ><FlipHorizontal /></Button>
        <Separator className='my-2' />
      </div>

      {/* Middle section */}
      <div className='flex flex-col gap-2'>
        
        <Button
          variant={'outline'} size={'icon'}
          onClick={userPromptScreenshot}
        >
          <Camera />
        </Button>
        <Button
          variant={isRecording ? 'destructive' : 'outline'} size={'icon'}
          onClick={userPromptRecord}
        >
          <Video />
        </Button>
        <Separator className='my-2' />
        <Button
          variant={autoRecordEnabled ? 'destructive' : 'outline'}
          size={'icon'}
          onClick={toggleAutoRecord}
        >
          {autoRecordEnabled ? <Rings color='white' height={45} /> : <PersonStanding />}
        </Button>
      </div>

      {/* Bottom section */}
      <div className='flex flex-col gap-2'>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={'outline'} size={'icon'}>
              <Volume2 />
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Slider
              max={1}
              min={0}
              step={0.2}
              defaultValue={[volume]}
              onValueCommit={(val) => {
                setVolume(val[0]);
                beep(val[0]);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div> 
  </div>
  {loading && <div className='z-50 absolute w-full h-full flex items-center justify-center bg-primary-foreground'>
    Getting things ready . . . <Rings height={50} color='red' />
  </div>}
</div>

  )
  
  function userPromptScreenshot() {

    // take picture
    if(!webcamRef.current){
      toast('Camera not found. Please refresh');
    }else{
      const imgSrc = webcamRef.current.getScreenshot();
      console.log(imgSrc);
      const blob = base64toBlob(imgSrc);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formatDate(new Date())}.png`
      a.click();
    }
    // save it to downloads

  }

  function userPromptRecord() {

    if (!webcamRef.current) {
      toast('Camera is not found. Please refresh.')
    }

    if (mediaRecorderRef.current?.state == 'recording') {
      // check if recording
      // then stop recording 
      // and save to downloads
      mediaRecorderRef.current.requestData();
      clearTimeout(stopTimeout);
      mediaRecorderRef.current.stop();
      toast('Recording saved to downloads');

    } else {
      // if not recording
      // start recording 
      startRecording(false);
    }
  }

  function startRecording(doBeep: boolean) {
    if (webcamRef.current && mediaRecorderRef.current?.state !== 'recording') {
      mediaRecorderRef.current?.start();
      doBeep && beep(volume);

      stopTimeout = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.requestData();
          mediaRecorderRef.current.stop();
        }

      }, 30000);
    }
  }

  function toggleAutoRecord() {
    if (autoRecordEnabled) {
      setAutoRecordEnabled(false);
      toast('Autorecord disabled')
      // show toast to user to notify the change

    } else {
      setAutoRecordEnabled(true);
      toast('Autorecord enabled')
      // show toast
    }

  }



}

export default HomePage

function resizeCanvas(canvasRef: React.RefObject<HTMLCanvasElement>, webcamRef: React.RefObject<Webcam>) {
  const canvas = canvasRef.current;
  const video = webcamRef.current?.video;

  if ((canvas && video)) {
    const { videoWidth, videoHeight } = video;
    canvas.width = videoWidth;
    canvas.height = videoHeight;
  }
}


function formatDate(d: Date) {
  const formattedDate =
    [
      (d.getMonth() + 1).toString().padStart(2, "0"),
      d.getDate().toString().padStart(2, "0"),
      d.getFullYear(),
    ]
      .join("-") +
    " " +
    [
      d.getHours().toString().padStart(2, "0"),
      d.getMinutes().toString().padStart(2, "0"),
      d.getSeconds().toString().padStart(2, "0"),
    ].join("-");
  return formattedDate;
}

function base64toBlob(base64Data: any) {
  const byteCharacters = atob(base64Data.split(",")[1]);
  const arrayBuffer = new ArrayBuffer(byteCharacters.length);
  const byteArray = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }

  return new Blob([arrayBuffer], { type: "image/png" }); // Specify the image type here
}