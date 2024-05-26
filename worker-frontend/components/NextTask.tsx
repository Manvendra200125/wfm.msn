"use client";
import { BACKEND_URL } from "@/utils";
import axios from "axios";
import { useEffect, useState } from "react";

interface Task {
  id: number;
  amount: number;
  title: string;
  options: {
    id: number;
    imageurl: string;
    task_id: number;
  }[];
}

export const NextTask = () => {
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${BACKEND_URL}/v1/worker/nextTask`, {
        headers: {
          Authorization: localStorage.getItem("token") || "",
        },
      })
      .then((res) => {
        setCurrentTask(res.data.task);
        setLoading(false);
      })
      .catch((e) => {
        setLoading(false);
        setCurrentTask(null);
      });
  }, []);

  const handleOptionSelect = async (optionId: number) => {
    setSubmitting(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/v1/worker/submission`,
        {
          taskId: currentTask?.id.toString() || "",
          selection: optionId.toString(),
        },
        {
          headers: {
            Authorization: localStorage.getItem("token") || "",
          },
        }
      );

      const nextTask = response.data.nextTask;
      setCurrentTask(nextTask || null);
      // refresh the user balance in the appbar
    } catch (e) {
      console.log(e);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="h-screen flex justify-center flex-col">
        <div className="w-full flex justify-center text-2xl">Loading...</div>
      </div>
    );
  }

  if (!currentTask) {
    return (
      <div className="h-screen flex justify-center flex-col">
        <div className="w-full flex justify-center text-2xl">
          Please check back in some time, there are no pending tasks at the
          moment
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-2xl pt-20 flex justify-center">
        {currentTask.title}
        <div className="pl-4  text-red-500">{submitting && "Submitting..."}</div>
      </div>
      <div className="flex justify-center pt-8">
        {currentTask.options.map((option) => (
          <Option
            key={option.id}
            imageUrl={option.imageurl}
            onSelect={() => handleOptionSelect(option.id)}
          />
        ))}
      </div>
    </div>
  );
};

const Option = ({
  imageUrl,
  onSelect,
}: {
  imageUrl: string;
  onSelect: () => void;
}) => {
    console.log("Image URL:", imageUrl);
  return (
    <div>
      <img
        onClick={onSelect}
        className="p-2 w-96 rounded-md"
        src={imageUrl}
        alt="option"
      />
    </div>
  );
};
