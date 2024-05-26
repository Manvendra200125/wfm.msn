import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import nacl from "tweetnacl";
import jwt from "jsonwebtoken";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { authMiddleware } from "../middleware";
import { createTaskInput } from "../types";
import { JWT_SECRET, TOTAL_DECIMALS } from "../config";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

const router = Router();
const Defult_title = "select best thumbnail";
const prismaClient = new PrismaClient();
const connection = new Connection(
  "https://solana-devnet.g.alchemy.com/v2/L4v2_e0ez21uU-WOZoBW9G0jSE02Kf0H"
);
const PARENT_WALLET_ADDRESS = "6nUJy3hEs3z2EtLKbi7cyetFd6zrbTEuzCt15Bk4fvgF";

const s3Client = new S3Client({
  credentials: {
    accessKeyId: "AKIAW3MD74N6AUPOFZ57",
    secretAccessKey: "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",
  },
  region: "eu-north-1",
});

prismaClient.$transaction(
  async (prisma) => {
    // Code running in a transaction...
  },
  {
    maxWait: 5000, // default: 2000
    timeout: 10000, // default: 5000
  }
);

router.get("/task", authMiddleware, async (req, res) => {
  // @ts-ignore
  const taskId: string = req.query.taskId;
  // @ts-ignore
  const userId: string = req.userId;

  const taskDetails = await prismaClient.task.findFirst({
    where: {
      user_id: Number(userId),
      id: Number(taskId),
    },
    include: {
      options: true,
    },
  });

  if (!taskDetails) {
    return res.status(411).json({
      message: "You dont have access to this task",
    });
  }

  // Todo: Can u make this faster?
  const responses = await prismaClient.submission.findMany({
    where: {
      task_id: Number(taskId),
    },
    include: {
      option: true,
    },
  });

  const result: Record<
    string,
    {
      count: number;
      option: {
        imageUrl: string;
      };
    }
  > = {};

  taskDetails.options.forEach((option) => {
    result[option.id] = {
      count: 0,
      option: {
        imageUrl: option.imageurl,
      },
    };
  });

  responses.forEach((r) => {
    result[r.option_id].count++;
  });

  res.json({
    result,
    taskDetails,
  });
});

router.post("/task", authMiddleware, async (req, res) => {
  const body = req.body;
  //@ts-ignore
  const userid = req.userId;

  const parseData = createTaskInput.safeParse(body);

  const user = await prismaClient.user.findFirst({
    where: {
      id: userid,
    },
  });

  if (!parseData.success) {
    return res.status(411).json({
      message: "you have enter wrong inputs",
    });
  }

  const transaction = await connection.getTransaction(
    parseData.data.signature,
    {
      maxSupportedTransactionVersion: 1,
    }
  );

  console.log(transaction);

  if (
    (transaction?.meta?.postBalances[1] ?? 0) -
      (transaction?.meta?.preBalances[1] ?? 0) !==
    100000000
  ) {
    return res.status(411).json({
      message: "Transaction signature/amount incorrect",
    });
  }

  if (
    transaction?.transaction.message.getAccountKeys().get(1)?.toString() !==
    PARENT_WALLET_ADDRESS
  ) {
    return res.status(411).json({
      message: "Transaction sent to wrong address",
    });
  }

  if (
    transaction?.transaction.message.getAccountKeys().get(0)?.toString() !==
    user?.address
  ) {
    return res.status(411).json({
      message: "Transaction sent to wrong address",
    });
  }

  let response = await prismaClient.$transaction(async (tx) => {
    const ress = await tx.task.create({
      data: {
        title: parseData.data.title ?? Defult_title,
        amount: 0.1 * TOTAL_DECIMALS,
        signature: parseData.data.signature,
        user_id: userid,
      },
    });

    await tx.option.createMany({
      data: parseData.data.options.map((x) => ({
        imageurl: x.imageUrl,
        task_id: ress.id,
      })),
    });

    return ress;
  });

  res.json({
    id: response.id,
  });
});

router.get("/presignedUrl", authMiddleware, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;

  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: "workformoney",
    Key: `wfm/${userId}/${Math.random()}/image.png`,
    Conditions: [
      ["content-length-range", 0, 5 * 1024 * 1024],
      ["eq", "$Content-Type", "image/png"], // 5 MB max
    ],
    Fields: {
      "Content-Type": "image/png",
    },
    Expires: 3600,
  });

  res.json({
    preSignedUrl: url,
    fields,
  });
});

router.post("/signin", async (req, res) => {
  const { publicKey, signature } = req.body;
  const message = new TextEncoder().encode("Sign into mechanical turks");

  const result = nacl.sign.detached.verify(
    message,
    new Uint8Array(signature.data),
    new PublicKey(publicKey).toBytes()
  );

  if (!result) {
    return res.status(411).json({
      message: "Incorrect signature",
    });
  }

  const existingUser = await prismaClient.user.findFirst({
    where: {
      address: publicKey,
    },
  });

  if (existingUser) {
    const token = jwt.sign(
      {
        userId: existingUser.id,
      },
      JWT_SECRET
    );

    res.json({
      token,
    });
  } else {
    const user = await prismaClient.user.create({
      data: {
        address: publicKey,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
      },
      JWT_SECRET
    );

    res.json({
      token,
    });
  }
});

export default router;
