import { PineconeClient } from "@pinecone-database/pinecone";
import { OpenAI } from "langchain/llms/openai";
import { VectorDBQAChain } from "langchain/chains";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import dotenv from "dotenv";

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT;
const PINECONE_INDEX = process.env.PINECONE_INDEX;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ORGANIZATION = process.env.ORGANIZATION;
if (
  !PINECONE_API_KEY ||
  !PINECONE_ENVIRONMENT ||
  !PINECONE_INDEX ||
  !OPENAI_API_KEY ||
  !ORGANIZATION
) {
  throw new Error(
    "Please set PINECONE_API_KEY, PINECONE_ENVIRONMENT, PINECONE_INDEX, OPENAI_API_KEY, ORGANIZATION"
  );
}

/**
 * @param {string} query - The query to ask
 *
 * @return {Promise<ChainValues>} - The response from the chain
 *
 * @example
 * const res = retrieval_qa({'query': msg});
 */
const retrieval_qa = async ({ query }) => {
  const client = new PineconeClient();
  /* Initialize the client */
  await client.init({
    apiKey: PINECONE_API_KEY,
    environment: PINECONE_ENVIRONMENT,
  });
  /* Get the index */
  const pineconeIndex = client.Index(PINECONE_INDEX);
  /* Initialize the vector store */
  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings(
      {},
      { apiKey: OPENAI_API_KEY, organization: ORGANIZATION }
    ),
    { pineconeIndex }
  );

  /* Use as part of a chain (currently no metadata filters) */
  const model = new OpenAI(
    {
      model_name: "gpt-3.5-turbo",
      temperature: 0,
    },
    { apiKey: OPENAI_API_KEY, organization: ORGANIZATION }
  );
  /* Initialize the chain */
  const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
    k: 1,
    returnSourceDocuments: true,
  });

  /* Ask a question */
  const response = await chain.call({ query });
  return response;
  /*
    {
        text: ' A pinecone is the woody fruiting body of a pine tree.',
        sourceDocuments: [
            Document {
                pageContent: 'pinecones are the woody fruiting body and of a pine tree',
                metadata: [Object]
            }
        ]
    }
    */
};

export default retrieval_qa;
