import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sosRouter from "./sos";
import insightsRouter from "./insights";
import scheduleRouter from "./schedule";
import fpaRouter from "./fpa";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sosRouter);
router.use(insightsRouter);
router.use(scheduleRouter);
router.use(fpaRouter);

export default router;
